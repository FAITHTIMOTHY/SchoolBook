import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { randomBytes } from 'crypto';
import * as argon2 from 'argon2';
import {
  REFRESH_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TYPE,
} from '../auth.constants.js';
import type { JwtRefreshPayload } from '../auth.types.js';
import type { CookieOptions } from 'express';

@Injectable()
export class RefreshTokensService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async generateRefreshToken(user: {
    id: string;
    tenantId: string;
    email: string;
    role: UserRole;
  }): Promise<string> {
    const jti = randomBytes(32).toString('hex');
    const payload: JwtRefreshPayload = {
      sub: user.id,
      tenantId: user.tenantId,
      email: user.email,
      role: user.role,
      type: REFRESH_TOKEN_TYPE,
      jti,
    };

    const token = await this.jwtService.signAsync(payload, {
      expiresIn: REFRESH_TOKEN_TTL_SECONDS,
    });

    const tokenHash = await argon2.hash(token);

    await this.prisma.refreshToken.create({
      data: {
        tenantId: user.tenantId,
        userId: user.id,
        jti,
        tokenHash,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000),
      },
    });

    return token;
  }

  async rotateRefreshToken(token: string): Promise<{
    userId: string;
    tenantId: string;
    email: string;
    role: UserRole;
    newRefreshToken: string;
  }> {
    let payload: JwtRefreshPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtRefreshPayload>(token);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (payload.type !== REFRESH_TOKEN_TYPE || !payload.jti) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const stored = await this.prisma.refreshToken.findFirst({
      where: {
        jti: payload.jti,
        userId: payload.sub,
        tenantId: payload.tenantId,
      },
    });

    if (!stored) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Token reuse detection: if already revoked, revoke all tokens for user
    if (stored.revokedAt) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: stored.userId, tenantId: stored.tenantId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Refresh token revoked');
    }

    if (stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const matches = await argon2.verify(stored.tokenHash, token);
    if (!matches) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.prisma.user.findFirst({
      where: { id: payload.sub, tenantId: payload.tenantId, isActive: true },
      select: { id: true, tenantId: true, email: true, role: true },
    });

    if (!user) {
      throw new UnauthorizedException('User account is not available');
    }

    // Revoke current token and issue new one
    const [newRefreshToken] = await Promise.all([
      this.generateRefreshToken(user),
      this.prisma.refreshToken.updateMany({
        where: {
          id: stored.id,
          userId: stored.userId,
          tenantId: stored.tenantId,
        },
        data: { revokedAt: new Date() },
      }),
    ]);

    return { userId: user.id, tenantId: user.tenantId, email: user.email, role: user.role, newRefreshToken };
  }

  async revokeAllForUser(userId: string, tenantId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, tenantId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  refreshCookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.configService.get<string>('NODE_ENV') === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: REFRESH_TOKEN_TTL_SECONDS * 1000,
    };
  }
}
