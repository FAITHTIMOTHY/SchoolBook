import { Injectable, ConflictException, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthService } from './auth.service.js';
import { RefreshTokensService } from './refresh-tokens/refresh-tokens.service.js';

@Injectable()
export class LocalAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly refreshTokensService: RefreshTokensService,
  ) {}

  async register(input: {
    tenantSlug: string;
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
  }) {
    const tenantSlug = input.tenantSlug.trim().toLowerCase();
    const email = input.email.trim().toLowerCase();

    const school = await this.prisma.school.findUnique({
      where: { slug: tenantSlug },
      select: { id: true, slug: true, isActive: true },
    });

    if (!school || !school.isActive) {
      throw new UnauthorizedException('School is not available');
    }

    const existing = await this.prisma.user.findFirst({
      where: { tenantId: school.id, email },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException('User already exists');
    }

    const passwordHash = await argon2.hash(input.password);
    const user = await this.prisma.user.create({
      data: {
        tenantId: school.id,
        email,
        passwordHash,
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        phone: input.phone?.trim() || null,
        role: 'STUDENT',
        isActive: true,
        lastLoginAt: new Date(),
      },
      select: {
        id: true,
        tenantId: true,
        email: true,
        role: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        tenant: { select: { slug: true } },
      },
    });

    const authUser = {
      id: user.id,
      tenantId: user.tenantId,
      tenantSlug: user.tenant.slug,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl,
    };

    const { accessToken, refreshToken } = await this.authService.issueTokens(authUser);
    return { user: authUser, accessToken, refreshToken };
  }

  async login(input: { tenantSlug: string; email: string; password: string }) {
    const tenantSlug = input.tenantSlug.trim().toLowerCase();
    const email = input.email.trim().toLowerCase();

    const school = await this.prisma.school.findUnique({
      where: { slug: tenantSlug },
      select: { id: true, slug: true, isActive: true },
    });

    if (!school || !school.isActive) {
      throw new UnauthorizedException('School is not available');
    }

    const user = await this.prisma.user.findFirst({
      where: { tenantId: school.id, email },
      select: {
        id: true,
        tenantId: true,
        email: true,
        role: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        passwordHash: true,
        isActive: true,
        tenant: { select: { slug: true } },
      },
    });

    if (!user || !user.passwordHash || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await argon2.verify(user.passwordHash, input.password);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.prisma.user.update({
      where: { id: user.id, tenantId: school.id },
      data: { lastLoginAt: new Date() },
    });

    const authUser = {
      id: user.id,
      tenantId: user.tenantId,
      tenantSlug: user.tenant.slug,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl,
    };

    const { accessToken, refreshToken } = await this.authService.issueTokens(authUser);
    return { user: authUser, accessToken, refreshToken };
  }
}
