import {
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { TenantService } from './tenant.service.js';

const TENANT_ID = 'tenant_1';
const CREATED_AT = new Date('2026-01-01T00:00:00.000Z');
const UPDATED_AT = new Date('2026-02-01T00:00:00.000Z');

function schoolRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: TENANT_ID,
    name: 'Oakridge International Academy',
    slug: 'oakridge',
    code: 'OAK',
    email: 'office@oakridge.test',
    phone: '+1-555-0100',
    address: '1 Academy Way',
    logoUrl: 'https://cdn.test/logo.png',
    website: 'https://oakridge.test',
    motto: 'Learn and lead',
    isActive: true,
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
    ...overrides,
  };
}

function createPrismaMock() {
  return {
    school: { findUnique: vi.fn() },
    student: { count: vi.fn() },
    staff: { count: vi.fn() },
    user: { count: vi.fn() },
    classroom: { count: vi.fn() },
    department: { count: vi.fn() },
    attendanceSession: { count: vi.fn() },
    invoice: { count: vi.fn() },
    $transaction: vi.fn(),
  };
}

type PrismaMock = ReturnType<typeof createPrismaMock>;

function createService(prisma: PrismaMock) {
  return new TenantService(prisma as unknown as PrismaService);
}

describe('TenantService', () => {
  describe('getCurrentTenant', () => {
    it('returns the tenant profile for the verified tenant id', async () => {
      const prisma = createPrismaMock();
      prisma.school.findUnique.mockResolvedValue(schoolRecord());
      const service = createService(prisma);

      const result = await service.getCurrentTenant(TENANT_ID);

      expect(prisma.school.findUnique).toHaveBeenCalledWith({
        where: { id: TENANT_ID },
        select: expect.any(Object),
      });
      expect(result).toEqual({
        id: TENANT_ID,
        name: 'Oakridge International Academy',
        slug: 'oakridge',
        code: 'OAK',
        email: 'office@oakridge.test',
        phone: '+1-555-0100',
        address: '1 Academy Way',
        logoUrl: 'https://cdn.test/logo.png',
        website: 'https://oakridge.test',
        motto: 'Learn and lead',
        isActive: true,
        createdAt: CREATED_AT.toISOString(),
        updatedAt: UPDATED_AT.toISOString(),
      });
    });

    it('throws UnauthorizedException when tenant context is missing', async () => {
      const prisma = createPrismaMock();
      const service = createService(prisma);

      await expect(service.getCurrentTenant('')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(prisma.school.findUnique).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the tenant does not exist', async () => {
      const prisma = createPrismaMock();
      prisma.school.findUnique.mockResolvedValue(null);
      const service = createService(prisma);

      await expect(service.getCurrentTenant(TENANT_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('throws ForbiddenException when the tenant is inactive', async () => {
      const prisma = createPrismaMock();
      prisma.school.findUnique.mockResolvedValue(
        schoolRecord({ isActive: false }),
      );
      const service = createService(prisma);

      await expect(service.getCurrentTenant(TENANT_ID)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });

  describe('getTenantOverview', () => {
    it('scopes every count to the verified tenant', async () => {
      const prisma = createPrismaMock();
      prisma.school.findUnique.mockResolvedValue({
        id: TENANT_ID,
        isActive: true,
      });
      prisma.$transaction.mockResolvedValue([
        120, 110, 24, 22, 150, 12, 5, 240, 7,
      ]);
      const service = createService(prisma);

      const result = await service.getTenantOverview(TENANT_ID);

      expect(prisma.student.count).toHaveBeenCalledWith({
        where: { tenantId: TENANT_ID },
      });
      expect(prisma.student.count).toHaveBeenCalledWith({
        where: { tenantId: TENANT_ID, status: 'ACTIVE' },
      });
      expect(prisma.staff.count).toHaveBeenCalledWith({
        where: { tenantId: TENANT_ID },
      });
      expect(prisma.user.count).toHaveBeenCalledWith({
        where: { tenantId: TENANT_ID },
      });
      expect(prisma.classroom.count).toHaveBeenCalledWith({
        where: { tenantId: TENANT_ID },
      });
      expect(prisma.department.count).toHaveBeenCalledWith({
        where: { tenantId: TENANT_ID },
      });
      expect(prisma.attendanceSession.count).toHaveBeenCalledWith({
        where: { tenantId: TENANT_ID },
      });
      expect(prisma.invoice.count).toHaveBeenCalledWith({
        where: {
          tenantId: TENANT_ID,
          status: { in: ['PENDING', 'PARTIALLY_PAID', 'OVERDUE'] },
        },
      });
      expect(result).toEqual({
        tenantId: TENANT_ID,
        counts: {
          students: 120,
          activeStudents: 110,
          staff: 24,
          activeStaff: 22,
          users: 150,
          classrooms: 12,
          departments: 5,
          attendanceSessions: 240,
          pendingInvoices: 7,
        },
        generatedAt: expect.any(String),
      });
    });

    it('throws UnauthorizedException when tenant context is missing', async () => {
      const prisma = createPrismaMock();
      const service = createService(prisma);

      await expect(service.getTenantOverview('')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('does not query metrics when the tenant is inactive', async () => {
      const prisma = createPrismaMock();
      prisma.school.findUnique.mockResolvedValue({
        id: TENANT_ID,
        isActive: false,
      });
      const service = createService(prisma);

      await expect(service.getTenantOverview(TENANT_ID)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });
});
