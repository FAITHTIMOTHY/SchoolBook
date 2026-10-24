import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma, UserRole } from '@prisma/client';
import type { CookieOptions } from 'express';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  OAUTH_STATE_TTL_SECONDS,
  OAUTH_STATE_TYPE,
  ACCESS_TOKEN_TYPE,
  REFRESH_TOKEN_COOKIE_NAME,
} from './auth.constants.js';
import type {
  AuthenticatedUser,
  JwtAccessPayload,
  OAuthStatePayload,
} from './auth.types.js';
import { RefreshTokensService } from './refresh-tokens/refresh-tokens.service.js';

const authUserSelect = {
  id: true,
  tenantId: true,
  email: true,
  role: true,
  firstName: true,
  lastName: true,
  avatarUrl: true,
  googleId: true,
  isActive: true,
  tenant: {
    select: {
      slug: true,
    },
  },
} satisfies Prisma.UserSelect;

type AuthUserRecord = Prisma.UserGetPayload<{ select: typeof authUserSelect }>;

export interface GoogleLoginInput {
  tenantSlug: string;
  googleId: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly refreshTokensService: RefreshTokensService,
  ) {}

  async validateGoogleLogin(input: GoogleLoginInput): Promise<AuthenticatedUser> {
    const tenantSlug = input.tenantSlug.trim().toLowerCase();
    const email = input.email.trim().toLowerCase();

    const school = await this.prisma.school.findUnique({
      where: { slug: tenantSlug },
      select: { id: true, slug: true, isActive: true },
    });

    if (!school || !school.isActive) {
      throw new UnauthorizedException('School is not available');
    }

    let user = await this.prisma.user.findFirst({
      where: {
        tenantId: school.id,
        OR: [{ googleId: input.googleId }, { email }],
      },
      select: authUserSelect,
    });

    if (user) {
      if (!user.isActive) {
        throw new UnauthorizedException('User account is inactive');
      }

      if (user.googleId && user.googleId !== input.googleId) {
        throw new UnauthorizedException('This email is linked to another Google account');
      }

      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          googleId: user.googleId ?? input.googleId,
          avatarUrl: user.avatarUrl ?? input.avatarUrl ?? undefined,
          lastLoginAt: new Date(),
        },
        select: authUserSelect,
      });
    } else {
      if (!this.isAutoProvisionEnabled()) {
        throw new UnauthorizedException(
          'No account is registered for this email. Contact your school administrator.',
        );
      }

      this.assertEmailDomainAllowed(email);

      user = await this.prisma.user.create({
        data: {
          tenantId: school.id,
          googleId: input.googleId,
          email,
          firstName: input.firstName,
          lastName: input.lastName,
          avatarUrl: input.avatarUrl,
          role: this.getAutoProvisionRole(),
          isActive: true,
          lastLoginAt: new Date(),
        },
        select: authUserSelect,
      });
    }

    return this.toAuthenticatedUser(user);
  }

  async issueAccessToken(user: AuthenticatedUser): Promise<string> {
    const payload: JwtAccessPayload = {
      sub: user.id,
      tenantId: user.tenantId,
      email: user.email,
      role: user.role,
      type: ACCESS_TOKEN_TYPE,
    };

    return this.jwtService.signAsync(payload);
  }

  async issueTokens(user: AuthenticatedUser): Promise<{ accessToken: string; refreshToken: string }> {
    const accessToken = await this.issueAccessToken(user);
    const refreshToken = await this.refreshTokensService.generateRefreshToken({
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      role: user.role,
    });
    return { accessToken, refreshToken };
  }

  async createOAuthState(tenantSlug: string): Promise<string> {
    const payload: OAuthStatePayload = {
      tenant: tenantSlug.trim().toLowerCase(),
      type: OAUTH_STATE_TYPE,
    };

    return this.jwtService.signAsync(payload, {
      expiresIn: OAUTH_STATE_TTL_SECONDS,
    });
  }

  async verifyOAuthState(state: string): Promise<string> {
    try {
      const payload = await this.jwtService.verifyAsync<OAuthStatePayload>(state);

      if (payload.type !== OAUTH_STATE_TYPE || !payload.tenant) {
        throw new Error('Invalid OAuth state');
      }

      return payload.tenant;
    } catch {
      throw new UnauthorizedException('Invalid or expired OAuth state');
    }
  }

  cookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.configService.get<string>('NODE_ENV') === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: ACCESS_TOKEN_TTL_SECONDS * 1000,
    };
  }

  refreshCookieOptions(): CookieOptions {
    return this.refreshTokensService.refreshCookieOptions();
  }

  clearCookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.configService.get<string>('NODE_ENV') === 'production',
      sameSite: 'lax',
      path: '/',
    };
  }

  clearAuthCookies() {
    return {
      access: this.clearCookieOptions(),
      refresh: this.clearCookieOptions(),
    };
  }

  private isAutoProvisionEnabled(): boolean {
    return this.configService.get<string>('GOOGLE_AUTO_PROVISION')?.toLowerCase() === 'true';
  }

  private getAutoProvisionRole(): UserRole {
    const configuredRole =
      this.configService.get<string>('GOOGLE_AUTO_PROVISION_ROLE') ?? UserRole.STUDENT;

    if (!Object.values(UserRole).includes(configuredRole as UserRole)) {
      throw new UnauthorizedException(
        `Invalid GOOGLE_AUTO_PROVISION_ROLE: ${configuredRole}`,
      );
    }

    return configuredRole as UserRole;
  }

  private assertEmailDomainAllowed(email: string): void {
    const configuredDomains = this.configService.get<string>('GOOGLE_ALLOWED_DOMAINS');

    if (!configuredDomains) {
      return;
    }

    const allowedDomains = configuredDomains
      .split(',')
      .map((domain) => domain.trim().toLowerCase())
      .filter(Boolean);

    const emailDomain = email.split('@')[1]?.toLowerCase();

    if (!emailDomain || !allowedDomains.includes(emailDomain)) {
      throw new UnauthorizedException('This email domain is not allowed to sign in');
    }
  }

  private toAuthenticatedUser(user: AuthUserRecord): AuthenticatedUser {
    return {
      id: user.id,
      tenantId: user.tenantId,
      tenantSlug: user.tenant.slug,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl,
    };
  }
}
