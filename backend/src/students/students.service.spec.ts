import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  EnrollmentStatus,
  Gender,
  GuardianRelationship,
  StudentStatus,
  UserRole,
} from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { StudentActorContext } from './students.types.js';
import { StudentsService } from './students.service.js';

const TENANT_ID = 'tenant_1';
const CREATED_AT = new Date('2026-01-01T00:00:00.000Z');
const UPDATED_AT = new Date('2026-02-01T00:00:00.000Z');
const ADMISSION_DATE = new Date('2026-01-05T00:00:00.000Z');

const actor: StudentActorContext = {
  id: 'admin_1',
  tenantId: TENANT_ID,
  role: UserRole.ADMIN,
};

function studentSummaryRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'student_1',
    tenantId: TENANT_ID,
    admissionNumber: 'ADM-001',
    firstName: 'Ada',
    lastName: 'Lovelace',
    otherNames: null,
    gender: Gender.FEMALE,
    dateOfBirth: null,
    admissionDate: ADMISSION_DATE,
    status: StudentStatus.ACTIVE,
    email: null,
    phone: null,
    photoUrl: null,
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
    ...overrides,
  };
}

function studentProfileRecord(overrides: Record<string, unknown> = {}) {
  return {
    ...studentSummaryRecord(),
    address: null,
    bloodGroup: null,
    allergies: null,
    notes: null,
    user: null,
    guardians: [],
    enrollments: [],
    ...overrides,
  };
}

function guardianLinkRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'link_1',
    relationship: GuardianRelationship.MOTHER,
    isPrimary: true,
    createdAt: CREATED_AT,
    guardian: {
      id: 'guardian_1',
      firstName: 'Grace',
      lastName: 'Hopper',
      email: 'grace@oakridge.test',
      phone: '+1-555-0101',
      occupation: 'Engineer',
      address: '1 Academy Way',
    },
    ...overrides,
  };
}

function createPrismaMock() {
  return {
    school: { findUnique: vi.fn() },
    user: { findFirst: vi.fn() },
    student: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    guardian: { findFirst: vi.fn() },
    studentGuardian: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(),
  };
}

type PrismaMock = ReturnType<typeof createPrismaMock>;

function createService(prisma: PrismaMock) {
  return new StudentsService(prisma as unknown as PrismaService);
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

describe('StudentsService', () => {
  describe('list', () => {
    it('scopes queries to the tenant and applies filters', async () => {
      const prisma = createPrismaMock();
      prisma.student.findMany.mockResolvedValue([studentSummaryRecord()]);
      prisma.student.count.mockResolvedValue(1);
      mockTransaction(prisma);
      const service = createService(prisma);

      const result = await service.list(TENANT_ID, {
        search: 'ada',
        status: StudentStatus.ACTIVE,
        gender: Gender.FEMALE,
        classroomId: 'class_1',
      });

      expect(prisma.student.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenantId: TENANT_ID,
            status: StudentStatus.ACTIVE,
            gender: Gender.FEMALE,
            enrollments: {
              some: { tenantId: TENANT_ID, classroomId: 'class_1' },
            },
            OR: [
              { firstName: { contains: 'ada', mode: 'insensitive' } },
              { lastName: { contains: 'ada', mode: 'insensitive' } },
              { admissionNumber: { contains: 'ada', mode: 'insensitive' } },
              { email: { contains: 'ada', mode: 'insensitive' } },
            ],
          },
          skip: 0,
          take: 20,
        }),
      );
      expect(result.meta.total).toBe(1);
    });

    it('rejects a missing tenant context without querying', async () => {
      const prisma = createPrismaMock();
      const service = createService(prisma);

      await expect(service.list('', {})).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(prisma.student.findMany).not.toHaveBeenCalled();
    });
  });

  describe('getById', () => {
    it('looks up by id and tenant id', async () => {
      const prisma = createPrismaMock();
      prisma.student.findFirst.mockResolvedValue(studentProfileRecord());
      const service = createService(prisma);

      const result = await service.getById(TENANT_ID, 'student_1');

      expect(prisma.student.findFirst).toHaveBeenCalledWith({
        where: { id: 'student_1', tenantId: TENANT_ID },
        select: expect.any(Object),
      });
      expect(result.id).toBe('student_1');
      expect(result.admissionDate).toBe('2026-01-05');
    });

    it('maps guardians and the current enrollment', async () => {
      const prisma = createPrismaMock();
      prisma.student.findFirst.mockResolvedValue(
        studentProfileRecord({
          guardians: [guardianLinkRecord()],
          enrollments: [
            {
              id: 'enrollment_1',
              status: EnrollmentStatus.ACTIVE,
              enrollmentDate: ADMISSION_DATE,
              classroom: {
                id: 'class_1',
                name: 'Grade 1',
                code: 'G1',
                gradeLevel: 1,
                section: 'A',
              },
              academicYear: { id: 'year_1', name: '2026' },
            },
          ],
        }),
      );
      const service = createService(prisma);

      const result = await service.getById(TENANT_ID, 'student_1');

      expect(result.guardians[0].guardian.lastName).toBe('Hopper');
      expect(result.currentEnrollment).toEqual(
        expect.objectContaining({
          id: 'enrollment_1',
          enrollmentDate: '2026-01-05',
        }),
      );
    });

    it("throws NotFoundException for another tenant's student", async () => {
      const prisma = createPrismaMock();
      prisma.student.findFirst.mockResolvedValue(null);
      const service = createService(prisma);

      await expect(
        service.getById(TENANT_ID, 'student_other'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('getMe', () => {
    it('resolves the student profile from the authenticated user id', async () => {
      const prisma = createPrismaMock();
      prisma.student.findFirst.mockResolvedValue(studentProfileRecord());
      const service = createService(prisma);

      await service.getMe(TENANT_ID, 'user_1');

      expect(prisma.student.findFirst).toHaveBeenCalledWith({
        where: { userId: 'user_1', tenantId: TENANT_ID },
        select: expect.any(Object),
      });
    });
  });

  describe('create', () => {
    it('sets tenantId from the verified actor and normalizes input', async () => {
      const prisma = createPrismaMock();
      prisma.school.findUnique.mockResolvedValue({ isActive: true });
      prisma.student.findFirst.mockResolvedValue(null);
      prisma.student.create.mockResolvedValue(studentProfileRecord());
      const service = createService(prisma);

      await service.create(actor, {
        admissionNumber: ' ADM-001 ',
        firstName: ' Ada ',
        lastName: ' Lovelace ',
        admissionDate: '2026-01-05',
        email: ' ADA@Oakridge.test ',
        tenantId: 'attacker_tenant',
      } as Parameters<StudentsService['create']>[1] & {
        tenantId: string;
      });

      expect(prisma.student.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId: TENANT_ID,
            admissionNumber: 'ADM-001',
            firstName: 'Ada',
            lastName: 'Lovelace',
            admissionDate: ADMISSION_DATE,
            email: 'ada@oakridge.test',
            status: StudentStatus.ACTIVE,
          }),
        }),
      );
    });

    it('rejects duplicate admission numbers within the tenant', async () => {
      const prisma = createPrismaMock();
      prisma.school.findUnique.mockResolvedValue({ isActive: true });
      prisma.student.findFirst.mockResolvedValue({ id: 'existing' });
      const service = createService(prisma);

      await expect(
        service.create(actor, {
          admissionNumber: 'ADM-001',
          firstName: 'Ada',
          lastName: 'Lovelace',
          admissionDate: '2026-01-05',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.student.create).not.toHaveBeenCalled();
    });

    it('refuses to link a user from another tenant', async () => {
      const prisma = createPrismaMock();
      prisma.school.findUnique.mockResolvedValue({ isActive: true });
      prisma.student.findFirst.mockResolvedValue(null);
      prisma.user.findFirst.mockResolvedValue(null);
      const service = createService(prisma);

      await expect(
        service.create(actor, {
          admissionNumber: 'ADM-001',
          firstName: 'Ada',
          lastName: 'Lovelace',
          admissionDate: '2026-01-05',
          userId: 'user_from_other_tenant',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.user.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: TENANT_ID }),
        }),
      );
      expect(prisma.student.create).not.toHaveBeenCalled();
    });

    it('refuses to link a user already attached to another student', async () => {
      const prisma = createPrismaMock();
      prisma.school.findUnique.mockResolvedValue({ isActive: true });
      prisma.student.findFirst.mockResolvedValue(null);
      prisma.user.findFirst.mockResolvedValue({
        id: 'user_1',
        student: { id: 'student_other' },
      });
      const service = createService(prisma);

      await expect(
        service.create(actor, {
          admissionNumber: 'ADM-001',
          firstName: 'Ada',
          lastName: 'Lovelace',
          admissionDate: '2026-01-05',
          userId: 'user_1',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('refuses to mutate an inactive tenant', async () => {
      const prisma = createPrismaMock();
      prisma.school.findUnique.mockResolvedValue({ isActive: false });
      const service = createService(prisma);

      await expect(
        service.create(actor, {
          admissionNumber: 'ADM-001',
          firstName: 'Ada',
          lastName: 'Lovelace',
          admissionDate: '2026-01-05',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.student.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('scopes updates to the tenant and normalizes fields', async () => {
      const prisma = createPrismaMock();
      prisma.school.findUnique.mockResolvedValue({ isActive: true });
      prisma.student.findFirst
        .mockResolvedValueOnce({ id: 'student_1' })
        .mockResolvedValueOnce(null);
      prisma.student.update.mockResolvedValue(
        studentProfileRecord({ firstName: 'Augusta' }),
      );
      const service = createService(prisma);

      await service.update(actor, 'student_1', {
        firstName: ' Augusta ',
        email: ' AUGUSTA@Oakridge.test ',
        admissionNumber: ' ADM-002 ',
      });

      expect(prisma.student.update).toHaveBeenCalledWith({
        where: { id: 'student_1', tenantId: TENANT_ID },
        data: {
          admissionNumber: 'ADM-002',
          firstName: 'Augusta',
          email: 'augusta@oakridge.test',
        },
        select: expect.any(Object),
      });
    });

    it('cannot update a student from another tenant', async () => {
      const prisma = createPrismaMock();
      prisma.school.findUnique.mockResolvedValue({ isActive: true });
      prisma.student.findFirst.mockResolvedValue(null);
      const service = createService(prisma);

      await expect(
        service.update(actor, 'student_other', { firstName: 'Nope' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.student.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('soft-withdraws instead of deleting academic history', async () => {
      const prisma = createPrismaMock();
      prisma.school.findUnique.mockResolvedValue({ isActive: true });
      prisma.student.findFirst.mockResolvedValue({ id: 'student_1' });
      prisma.student.update.mockResolvedValue(
        studentProfileRecord({ status: StudentStatus.WITHDRAWN }),
      );
      const service = createService(prisma);

      const result = await service.remove(actor, 'student_1');

      expect(prisma.student.update).toHaveBeenCalledWith({
        where: { id: 'student_1', tenantId: TENANT_ID },
        data: { status: StudentStatus.WITHDRAWN },
        select: expect.any(Object),
      });
      expect(result.status).toBe(StudentStatus.WITHDRAWN);
    });
  });

  describe('guardians', () => {
    it('links only guardians that belong to the tenant', async () => {
      const prisma = createPrismaMock();
      prisma.school.findUnique.mockResolvedValue({ isActive: true });
      prisma.student.findFirst.mockResolvedValue({ id: 'student_1' });
      prisma.guardian.findFirst.mockResolvedValue(null);
      prisma.studentGuardian.findFirst.mockResolvedValue(null);
      const service = createService(prisma);

      await expect(
        service.linkGuardian(actor, 'student_1', {
          guardianId: 'guardian_other',
          relationship: GuardianRelationship.MOTHER,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.guardian.findFirst).toHaveBeenCalledWith({
        where: { id: 'guardian_other', tenantId: TENANT_ID },
        select: { id: true },
      });
      expect(prisma.studentGuardian.create).not.toHaveBeenCalled();
    });

    it('unsets other primary guardians when linking a new primary', async () => {
      const prisma = createPrismaMock();
      prisma.school.findUnique.mockResolvedValue({ isActive: true });
      prisma.student.findFirst.mockResolvedValue({ id: 'student_1' });
      prisma.guardian.findFirst.mockResolvedValue({ id: 'guardian_1' });
      prisma.studentGuardian.findFirst.mockResolvedValue(null);
      prisma.studentGuardian.updateMany.mockResolvedValue({ count: 1 });
      prisma.studentGuardian.create.mockResolvedValue(guardianLinkRecord());
      mockTransaction(prisma);
      const service = createService(prisma);

      const result = await service.linkGuardian(actor, 'student_1', {
        guardianId: 'guardian_1',
        relationship: GuardianRelationship.MOTHER,
        isPrimary: true,
      });

      expect(prisma.studentGuardian.updateMany).toHaveBeenCalledWith({
        where: { tenantId: TENANT_ID, studentId: 'student_1' },
        data: { isPrimary: false },
      });
      expect(prisma.studentGuardian.create).toHaveBeenCalledWith({
        data: {
          tenantId: TENANT_ID,
          studentId: 'student_1',
          guardianId: 'guardian_1',
          relationship: GuardianRelationship.MOTHER,
          isPrimary: true,
        },
        select: expect.any(Object),
      });
      expect(result.guardian.id).toBe('guardian_1');
    });

    it('scopes guardian unlinks to the tenant and student', async () => {
      const prisma = createPrismaMock();
      prisma.school.findUnique.mockResolvedValue({ isActive: true });
      prisma.studentGuardian.deleteMany.mockResolvedValue({ count: 1 });
      const service = createService(prisma);

      await service.unlinkGuardian(actor, 'student_1', 'guardian_1');

      expect(prisma.studentGuardian.deleteMany).toHaveBeenCalledWith({
        where: {
          tenantId: TENANT_ID,
          studentId: 'student_1',
          guardianId: 'guardian_1',
        },
      });
    });
  });
});
