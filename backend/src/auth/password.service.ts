import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { randomBytes } from 'crypto';
import * as argon2 from 'argon2';
import { EmailService } from '../common/email/email.service.js';
import { RefreshTokensService } from './refresh-tokens/refresh-tokens.service.js';
import { toASCII } from 'punycode';

@Injectable()
export class PasswordService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly refreshTokensService: RefreshTokensService,
  ) {}

  private normalizeEmail(email: string): string {
    const trimmed = email.trim();
    const [local, domain] = trimmed.split('@');
    if (!domain) return trimmed.toLowerCase();
    // Normalize domain (punycode + lowercase)
    const normalizedDomain = toASCII(domain.toLowerCase());
    return `${local.toLowerCase()}@${normalizedDomain}`;
  }

  private async constantTimeDelay(minMs = 150, maxMs = 250): Promise<void> {
    const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  async requestPasswordReset(tenantSlug: string, email: string): Promise<void> {
    const start = Date.now();
    try {
      const tenant = await this.prisma.school.findUnique({
        where: { slug: tenantSlug.trim().toLowerCase() },
        select: { id: true, isActive: true },
      });

      if (tenant && tenant.isActive) {
        const normalizedEmail = this.normalizeEmail(email);
        const user = await this.prisma.user.findFirst({
          where: { tenantId: tenant.id, email: normalizedEmail },
          select: { id: true, email: true },
        });

        if (user) {
          await this.prisma.passwordResetToken.updateMany({
            where: { userId: user.id, usedAt: null },
            data: { usedAt: new Date() },
          });

          const token = randomBytes(32).toString('hex');
          const tokenHash = await argon2.hash(token);
          const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

          await this.prisma.passwordResetToken.create({
            data: {
              tenantId: tenant.id,
              userId: user.id,
              tokenHash,
              expiresAt,
            },
          });

          await this.emailService.sendPasswordResetEmail(user.email, tenantSlug, token);
        }
      }
    } finally {
      const elapsed = Date.now() - start;
      const minDelay = 200;
      if (elapsed < minDelay) {
        await new Promise((resolve) => setTimeout(resolve, minDelay - elapsed));
      } else {
        await this.constantTimeDelay(50, 100);
      }
    }
  }

  async resetPassword(tenantSlug: string, token: string, password: string): Promise<void> {
    const start = Date.now();
    try {
      const tenant = await this.prisma.school.findUnique({
        where: { slug: tenantSlug.trim().toLowerCase() },
        select: { id: true, isActive: true },
      });

      if (!tenant || !tenant.isActive) {
        throw new UnauthorizedException('Invalid or expired token');
      }

      const tokens = await this.prisma.passwordResetToken.findMany({
        where: { tenantId: tenant.id, usedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: 'desc' },
      });

      for (const t of tokens) {
        const match = await argon2.verify(t.tokenHash, token);
        if (match) {
          const passwordHash = await argon2.hash(password);
          const user = await this.prisma.user.findUnique({
            where: { id: t.userId },
            select: { email: true },
          });

          await this.prisma.$transaction([
            this.prisma.user.update({
              where: { id: t.userId },
              data: { passwordHash },
            }),
            this.prisma.passwordResetToken.update({
              where: { id: t.id },
              data: { usedAt: new Date() },
            }),
            this.prisma.passwordResetToken.updateMany({
              where: { userId: t.userId, usedAt: null },
              data: { usedAt: new Date() },
            }),
          ]);

          await this.refreshTokensService.revokeAllForUser(t.userId, t.tenantId);
          if (user) {
            await this.emailService.sendPasswordChangedEmail(user.email, tenantSlug);
          }
          return;
        }
      }

      throw new UnauthorizedException('Invalid or expired token');
    } finally {
      const elapsed = Date.now() - start;
      const minDelay = 200;
      if (elapsed < minDelay) {
        await new Promise((resolve) => setTimeout(resolve, minDelay - elapsed));
      } else {
        await this.constantTimeDelay(50, 100);
      }
    }
  }

  async requestEmailVerification(tenantSlug: string, userId: string): Promise<void> {
    const tenant = await this.prisma.school.findUnique({
      where: { slug: tenantSlug.trim().toLowerCase() },
      select: { id: true, isActive: true },
    });

    if (!tenant || !tenant.isActive) {
      return;
    }

    await this.prisma.emailVerificationToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    });

    const token = randomBytes(32).toString('hex');
    const tokenHash = await argon2.hash(token);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await this.prisma.emailVerificationToken.create({
      data: {
        tenantId: tenant.id,
        userId,
        tokenHash,
        expiresAt,
      },
    });

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    if (user) {
      await this.emailService.sendEmailVerificationEmail(user.email, tenantSlug, token);
    }
  }

  async verifyEmail(tenantSlug: string, token: string): Promise<void> {
    const tenant = await this.prisma.school.findUnique({
      where: { slug: tenantSlug.trim().toLowerCase() },
      select: { id: true, isActive: true },
    });

    if (!tenant || !tenant.isActive) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const tokens = await this.prisma.emailVerificationToken.findMany({
      where: { tenantId: tenant.id, usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });

    for (const t of tokens) {
      const match = await argon2.verify(t.tokenHash, token);
      if (match) {
        await this.prisma.$transaction([
          this.prisma.user.update({
            where: { id: t.userId },
            data: { emailVerifiedAt: new Date() },
          }),
          this.prisma.emailVerificationToken.update({
            where: { id: t.id },
            data: { usedAt: new Date() },
          }),
          this.prisma.emailVerificationToken.updateMany({
            where: { userId: t.userId, usedAt: null },
            data: { usedAt: new Date() },
          }),
        ]);
        return;
      }
    }

    throw new UnauthorizedException('Invalid or expired token');
  }
}
