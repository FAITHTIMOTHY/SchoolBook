import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { CreateUserInput, UserActorContext } from './users.types.js';
import { UsersService } from './users.service.js';

const TENANT_ID = 'tenant_1';
const CREATED_AT = new Date('2026-01-01T00:00:00.000Z');
const UPDATED_AT = new Date('2026-02-01T00:00:00.000Z');

const admin: UserActorContext = {
  id: 'admin_1',
  tenantId: TENANT_ID,
  role: UserRole.ADMIN,
};

function userRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user_1',
    tenantId: TENANT_ID,
    email: 'ada@oakridge.test',
    firstName: 'Ada',
    lastName: 'Lovelace',
    phone: null,
    avatarUrl: null,
    role: UserRole.TEACHER,
    isActive: true,
    emailVerifiedAt: null,
    lastLoginAt: null,
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
    staff: null,
    student: null,
    guardian: null,
    ...overrides,
  };
}

function createPrismaMock() {
  const prisma = {
    school: { findUnique: vi.fn() },
    user: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    staff: { findFirst: vi.fn(), update: vi.fn() },
    student: { findFirst: vi.fn(), update: vi.fn() },
    guardian: { findFirst: vi.fn(), update: vi.fn() },
    refreshToken: { updateMany: vi.fn() },
    $transaction: vi.fn(),
  };

  return prisma;
}

type PrismaMock = ReturnType<typeof createPrismaMock>;

function createService(prisma: PrismaMock) {
  return new UsersService(prisma as unknown as PrismaService);
}

function mockTransaction(prisma: PrismaMock) {
  prisma.$transaction.mockImplementation(
    async (arg: unknown) => {
      if (typeof arg === 'function') {
        return (arg as (tx: PrismaMock) => unknown)(prisma);
      }

      return Promise.all(arg as Promise<unknown>[]);
    },
  );
}

describe('UsersService', () => {
  describe('list', () => {
    it('scopes every query to the verified tenant and paginates', async () => {
      const prisma = createPrismaMock();
      prisma.user.findMany.mockResolvedValue([userRecord()]);
      prisma.user.count.mockResolvedValue(1);
      mockTransaction(prisma);
      const service = createService(prisma);

      const result = await service.list(TENANT_ID, {
        search: 'ada',
        role: UserRole.TEACHER,
      });

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenantId: TENANT_ID,
            role: UserRole.TEACHER,
            OR: [
              { firstName: { contains: 'ada', mode: 'insensitive' } },
              { lastName: { contains: 'ada', mode: 'insensitive' } },
              { email: { contains: 'ada', mode: 'insensitive' } },
            ],
          },
          skip: 0,
          take: 20,
        }),
      );
      expect(prisma.user.count).toHaveBeenCalledWith({
        where: expect.objectContaining({ tenantId: TENANT_ID }),
      });
      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual({
        page: 1,
        pageSize: 20,
        total: 1,
        totalPages: 1,
      });
    });

    it('rejects a missing tenant context without querying', async () => {
      const prisma = createPrismaMock();
      const service = createService(prisma);

      await expect(service.list('', {})).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(prisma.user.findMany).not.toHaveBeenCalled();
    });
  });

  describe('getById', () => {
    it('looks the user up by id and tenant id', async () => {
      const prisma = createPrismaMock();
      prisma.user.findFirst.mockResolvedValue(userRecord());
      const service = createService(prisma);

      const result = await service.getById(TENANT_ID, 'user_1');

      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: { id: 'user_1', tenantId: TENANT_ID },
        select: expect.any(Object),
      });
      expect(result.id).toBe('user_1');
      expect(result).not.toHaveProperty('passwordHash');
    });

    it('throws NotFoundException for another tenant\'s user', async () => {
      const prisma = createPrismaMock();
      prisma.user.findFirst.mockResolvedValue(null);
      const service = createService(prisma);

      await expect(
        service.getById(TENANT_ID, 'someone_else'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('create', () => {
    it('sets tenantId from the verified actor, not from input', async () => {
      const prisma = createPrismaMock();
      prisma.school.findUnique.mockResolvedValue({ isActive: true });
      prisma.user.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(userRecord());
      prisma.user.create.mockResolvedValue({ id: 'user_1' });
      mockTransaction(prisma);
      const service = createService(prisma);

      const input = {
        email: '  Ada@Oakridge.test ',
        firstName: ' Ada ',
        lastName: ' Lovelace ',
        tenantId: 'attacker_tenant',
      } as CreateUserInput & { tenantId: string };

      await service.create(admin, input);

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId: TENANT_ID,
            email: 'ada@oakridge.test',
            firstName: 'Ada',
            lastName: 'Lovelace',
            role: UserRole.STUDENT,
            passwordHash: null,
          }),
        }),
      );
      expect(prisma.user.create).not.toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ tenantId: 'attacker_tenant' }),
        }),
      );
    });

    it('blocks assigning a role above the actor', async () => {
      const prisma = createPrismaMock();
      prisma.school.findUnique.mockResolvedValue({ isActive: true });
      const service = createService(prisma);

      await expect(
        service.create(admin, {
          email: 'new@oakridge.test',
          firstName: 'New',
          lastName: 'Admin',
          role: UserRole.SUPER_ADMIN,
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('rejects duplicate emails within the tenant', async () => {
      const prisma = createPrismaMock();
      prisma.school.findUnique.mockResolvedValue({ isActive: true });
      prisma.user.findFirst.mockResolvedValue({ id: 'existing' });
      const service = createService(prisma);

      await expect(
        service.create(admin, {
          email: 'ada@oakridge.test',
          firstName: 'Ada',
          lastName: 'Lovelace',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('refuses to operate when the tenant is inactive', async () => {
      const prisma = createPrismaMock();
      prisma.school.findUnique.mockResolvedValue({ isActive: false });
      const service = createService(prisma);

      await expect(
        service.create(admin, {
          email: 'ada@oakridge.test',
          firstName: 'Ada',
          lastName: 'Lovelace',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('prevents users from managing themselves through the admin endpoint', async () => {
      const prisma = createPrismaMock();
      prisma.school.findUnique.mockResolvedValue({ isActive: true });
      prisma.user.findFirst.mockResolvedValue({
        id: admin.id,
        role: admin.role,
        isActive: true,
      });
      const service = createService(prisma);

      await expect(
        service.update(admin, admin.id, { firstName: 'Nope' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('prevents managing users with an equal or higher role', async () => {
      const prisma = createPrismaMock();
      prisma.school.findUnique.mockResolvedValue({ isActive: true });
      prisma.user.findFirst.mockResolvedValue({
        id: 'other_admin',
        role: UserRole.ADMIN,
        isActive: true,
      });
      const service = createService(prisma);

      await expect(
        service.update(admin, 'other_admin', { firstName: 'Nope' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('normalizes email and scopes the update to the tenant', async () => {
      const prisma = createPrismaMock();
      prisma.school.findUnique.mockResolvedValue({ isActive: true });
      prisma.user.findFirst
        .mockResolvedValueOnce({
          id: 'user_1',
          role: UserRole.TEACHER,
          isActive: true,
        })
        .mockResolvedValueOnce(null);
      prisma.user.update.mockResolvedValue(userRecord());
      const service = createService(prisma);

      await service.update(admin, 'user_1', {
        email: '  New@Oakridge.test ',
        firstName: ' Ada ',
      });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user_1', tenantId: TENANT_ID },
        data: { email: 'new@oakridge.test', firstName: 'Ada' },
        select: expect.any(Object),
      });
    });
  });

  describe('setActive', () => {
    it('revokes refresh tokens when deactivating an account', async () => {
      const prisma = createPrismaMock();
      prisma.school.findUnique.mockResolvedValue({ isActive: true });
      prisma.user.findFirst.mockResolvedValue({
        id: 'user_1',
        role: UserRole.TEACHER,
        isActive: true,
      });
      prisma.user.update.mockResolvedValue(userRecord({ isActive: false }));
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });
      const service = createService(prisma);

      const result = await service.setActive(admin, 'user_1', false);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user_1', tenantId: TENANT_ID },
        data: { isActive: false },
        select: expect.any(Object),
      });
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { tenantId: TENANT_ID, userId: 'user_1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
      expect(result.isActive).toBe(false);
    });
  });

  describe('remove', () => {
    it('soft-deactivates instead of deleting academic records', async () => {
      const prisma = createPrismaMock();
      prisma.school.findUnique.mockResolvedValue({ isActive: true });
      prisma.user.findFirst.mockResolvedValue({
        id: 'user_1',
        role: UserRole.STUDENT,
        isActive: true,
      });
      prisma.user.update.mockResolvedValue(userRecord({ isActive: false }));
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });
      const service = createService(prisma);

      await service.remove(admin, 'user_1');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user_1', tenantId: TENANT_ID },
        data: { isActive: false },
        select: expect.any(Object),
      });
    });
  });
});
