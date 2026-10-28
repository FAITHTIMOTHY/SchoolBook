import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
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

  async signup(input: {
    schoolName: string;
    schoolSlug?: string;
    firstName: string;
    lastName: string;
    email: string;
    password: string;
  }) {
    const email = input.email.trim().toLowerCase();
    const schoolName = input.schoolName.trim();
    let slug = (input.schoolSlug || schoolName)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    if (!slug) {
      slug = `school-${Date.now().toString(36)}`;
    }

    const existingSchool = await this.prisma.school.findUnique({ where: { slug } });
    if (existingSchool) {
      slug = `${slug}-${Math.floor(1000 + Math.random() * 9000)}`;
    }

    const existingUser = await this.prisma.user.findFirst({
      where: { email },
    });
    if (existingUser) {
      throw new ConflictException(
        'An account with this email address already exists. Please sign in instead.',
      );
    }

    const passwordHash = await argon2.hash(input.password);

    const result = await this.prisma.$transaction(async (tx) => {
      const school = await tx.school.create({
        data: {
          name: schoolName,
          slug,
          email,
          isActive: true,
        },
      });

      const user = await tx.user.create({
        data: {
          tenantId: school.id,
          email,
          firstName: input.firstName.trim(),
          lastName: input.lastName.trim(),
          passwordHash,
          role: UserRole.PRINCIPAL,
          isActive: true,
          lastLoginAt: new Date(),
        },
      });

      await tx.staff.create({
        data: {
          tenantId: school.id,
          userId: user.id,
          employeeNumber: 'ADM-001',
          firstName: input.firstName.trim(),
          lastName: input.lastName.trim(),
          email,
          hireDate: new Date(),
          jobTitle: 'Principal',
        },
      });

      return { school, user };
    });

    const authUser = {
      id: result.user.id,
      tenantId: result.school.id,
      tenantSlug: result.school.slug,
      email: result.user.email,
      role: result.user.role,
      firstName: result.user.firstName,
      lastName: result.user.lastName,
      avatarUrl: result.user.avatarUrl,
    };

    const { accessToken, refreshToken } = await this.authService.issueTokens(authUser);
    return { user: authUser, accessToken, refreshToken };
  }
}
