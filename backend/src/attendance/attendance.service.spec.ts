import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  AttendanceSessionStatus,
  AttendanceStatus,
  UserRole,
} from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { AttendanceActorContext } from './attendance.types.js';
import { AttendanceService } from './attendance.service.js';

const TENANT_ID = 'tenant_1';
const CREATED_AT = new Date('2026-01-01T00:00:00.000Z');
const UPDATED_AT = new Date('2026-02-01T00:00:00.000Z');
const SESSION_DATE = new Date('2026-03-02T00:00:00.000Z');

const actor: AttendanceActorContext = {
  id: 'user_1',
  tenantId: TENANT_ID,
  role: UserRole.TEACHER,
};

function sessionSummaryRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'session_1',
    tenantId: TENANT_ID,
    classroomId: 'class_1',
    termId: 'term_1',
    subjectId: null,
    period: 'FULL_DAY',
    date: SESSION_DATE,
    status: AttendanceSessionStatus.DRAFT,
    takenById: null,
    notes: null,
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
    classroom: { id: 'class_1', name: 'Grade 1', code: 'G1' },
    term: { id: 'term_1', name: 'Term 1', academicYearId: 'year_1' },
    subject: null,
    takenBy: null,
    _count: { records: 0 },
    ...overrides,
  };
}

function sessionDetailRecord(overrides: Record<string, unknown> = {}) {
  return {
    ...sessionSummaryRecord(),
    records: [],
    ...overrides,
  };
}

function recordSummaryRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'record_1',
    sessionId: 'session_1',
    studentId: 'student_1',
    status: AttendanceStatus.PRESENT,
    remarks: null,
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
    student: {
      id: 'student_1',
      admissionNumber: 'ADM-001',
      firstName: 'Ada',
      lastName: 'Lovelace',
    },
    ...overrides,
  };
}

function createPrismaMock() {
  return {
    school: { findUnique: vi.fn() },
    classroom: { findFirst: vi.fn() },
    term: { findFirst: vi.fn() },
    subject: { findFirst: vi.fn() },
    staff: { findFirst: vi.fn() },
    student: { findMany: vi.fn() },
    enrollment: { findMany: vi.fn() },
    attendanceSession: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    attendanceRecord: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  };
}

type PrismaMock = ReturnType<typeof createPrismaMock>;

function createService(prisma: PrismaMock) {
  return new AttendanceService(prisma as unknown as PrismaService);
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

describe('AttendanceService', () => {
  describe('listSessions', () => {
    it('scopes queries to the tenant and applies filters', async () => {
      const prisma = createPrismaMock();
      prisma.attendanceSession.findMany.mockResolvedValue([
        sessionSummaryRecord(),
      ]);
      prisma.attendanceSession.count.mockResolvedValue(1);
      mockTransaction(prisma);
      const service = createService(prisma);

      const result = await service.listSessions(TENANT_ID, {
        classroomId: 'class_1',
        termId: 'term_1',
        status: AttendanceSessionStatus.DRAFT,
        dateFrom: '2026-03-01',
        dateTo: '2026-03-31',
      });

      expect(prisma.attendanceSession.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenantId: TENANT_ID,
            classroomId: 'class_1',
            termId: 'term_1',
            status: AttendanceSessionStatus.DRAFT,
            date: {
              gte: new Date('2026-03-01'),
              lte: new Date('2026-03-31'),
            },
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

      await expect(service.listSessions('', {})).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(prisma.attendanceSession.findMany).not.toHaveBeenCalled();
    });

    it('rejects inverted date ranges', async () => {
      const prisma = createPrismaMock();
      const service = createService(prisma);

      await expect(
        service.listSessions(TENANT_ID, {
          dateFrom: '2026-04-01',
          dateTo: '2026-03-01',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('getSession', () => {
    it('scopes session lookups to the tenant and summarizes records', async () => {
      const prisma = createPrismaMock();
      prisma.attendanceSession.findFirst.mockResolvedValue(
        sessionDetailRecord({
          records: [
            recordSummaryRecord(),
            recordSummaryRecord({
              id: 'record_2',
              studentId: 'student_2',
              status: AttendanceStatus.ABSENT,
            }),
          ],
        }),
      );
      const service = createService(prisma);

      const result = await service.getSession(TENANT_ID, 'session_1');

      expect(prisma.attendanceSession.findFirst).toHaveBeenCalledWith({
        where: { id: 'session_1', tenantId: TENANT_ID },
        select: expect.any(Object),
      });
      expect(result.summary).toEqual({
        total: 2,
        present: 1,
        absent: 1,
        late: 0,
        excused: 0,
        holiday: 0,
      });
    });

    it("throws NotFoundException for another tenant's session", async () => {
      const prisma = createPrismaMock();
      prisma.attendanceSession.findFirst.mockResolvedValue(null);
      const service = createService(prisma);

      await expect(
        service.getSession(TENANT_ID, 'session_other'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('createSession', () => {
    it('sets tenantId from the actor and resolves the staff member automatically', async () => {
      const prisma = createPrismaMock();
      prisma.school.findUnique.mockResolvedValue({ isActive: true });
      prisma.classroom.findFirst.mockResolvedValue({ id: 'class_1' });
      prisma.term.findFirst.mockResolvedValue({ id: 'term_1' });
      prisma.staff.findFirst.mockResolvedValue({ id: 'staff_1' });
      prisma.attendanceSession.create.mockResolvedValue(sessionDetailRecord());
      const service = createService(prisma);

      await service.createSession(actor, {
        classroomId: 'class_1',
        termId: 'term_1',
        date: '2026-03-02',
        tenantId: 'attacker_tenant',
      } as Parameters<AttendanceService['createSession']>[1] & {
        tenantId: string;
      });

      expect(prisma.attendanceSession.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId: TENANT_ID,
            classroomId: 'class_1',
            termId: 'term_1',
            period: 'FULL_DAY',
            date: SESSION_DATE,
            takenById: 'staff_1',
          }),
        }),
      );
      expect(prisma.staff.findFirst).toHaveBeenCalledWith({
        where: { tenantId: TENANT_ID, userId: actor.id },
        select: { id: true },
      });
    });

    it("refuses a classroom from another tenant", async () => {
      const prisma = createPrismaMock();
      prisma.school.findUnique.mockResolvedValue({ isActive: true });
      prisma.classroom.findFirst.mockResolvedValue(null);
      prisma.term.findFirst.mockResolvedValue({ id: 'term_1' });
      const service = createService(prisma);

      await expect(
        service.createSession(actor, {
          classroomId: 'class_other',
          termId: 'term_1',
          date: '2026-03-02',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.attendanceSession.create).not.toHaveBeenCalled();
    });

    it('refuses to mutate an inactive tenant', async () => {
      const prisma = createPrismaMock();
      prisma.school.findUnique.mockResolvedValue({ isActive: false });
      const service = createService(prisma);

      await expect(
        service.createSession(actor, {
          classroomId: 'class_1',
          termId: 'term_1',
          date: '2026-03-02',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.attendanceSession.create).not.toHaveBeenCalled();
    });
  });

  describe('session workflow', () => {
    it('only edits draft sessions', async () => {
      const prisma = createPrismaMock();
      prisma.school.findUnique.mockResolvedValue({ isActive: true });
      prisma.attendanceSession.findFirst.mockResolvedValue({
        id: 'session_1',
        status: AttendanceSessionStatus.SUBMITTED,
      });
      const service = createService(prisma);

      await expect(
        service.updateSession(actor, 'session_1', { notes: 'Nope' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.attendanceSession.update).not.toHaveBeenCalled();
    });

    it('only deletes draft sessions', async () => {
      const prisma = createPrismaMock();
      prisma.school.findUnique.mockResolvedValue({ isActive: true });
      prisma.attendanceSession.findFirst.mockResolvedValue({
        id: 'session_1',
        status: AttendanceSessionStatus.SUBMITTED,
      });
      const service = createService(prisma);

      await expect(
        service.deleteSession(actor, 'session_1'),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.attendanceSession.delete).not.toHaveBeenCalled();
    });

    it('rejects submitting an empty register', async () => {
      const prisma = createPrismaMock();
      prisma.school.findUnique.mockResolvedValue({ isActive: true });
      prisma.attendanceSession.findFirst.mockResolvedValue({
        id: 'session_1',
        status: AttendanceSessionStatus.DRAFT,
        _count: { records: 0 },
      });
      const service = createService(prisma);

      await expect(
        service.submitSession(actor, 'session_1'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('only locks submitted sessions', async () => {
      const prisma = createPrismaMock();
      prisma.school.findUnique.mockResolvedValue({ isActive: true });
      prisma.attendanceSession.findFirst.mockResolvedValue({
        id: 'session_1',
        status: AttendanceSessionStatus.DRAFT,
      });
      const service = createService(prisma);

      await expect(
        service.lockSession(actor, 'session_1'),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('saveRecords', () => {
    it('rejects writes to a locked session', async () => {
      const prisma = createPrismaMock();
      prisma.school.findUnique.mockResolvedValue({ isActive: true });
      prisma.attendanceSession.findFirst.mockResolvedValue({
        id: 'session_1',
        status: AttendanceSessionStatus.LOCKED,
        classroomId: 'class_1',
        term: { academicYearId: 'year_1' },
      });
      const service = createService(prisma);

      await expect(
        service.saveRecords(actor, 'session_1', {
          records: [
            { studentId: 'student_1', status: AttendanceStatus.PRESENT },
          ],
        }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.attendanceRecord.upsert).not.toHaveBeenCalled();
    });

    it('requires students to be enrolled in the session classroom', async () => {
      const prisma = createPrismaMock();
      prisma.school.findUnique.mockResolvedValue({ isActive: true });
      prisma.attendanceSession.findFirst.mockResolvedValue({
        id: 'session_1',
        status: AttendanceSessionStatus.DRAFT,
        classroomId: 'class_1',
        term: { academicYearId: 'year_1' },
      });
      prisma.student.findMany.mockResolvedValue([{ id: 'student_1' }]);
      prisma.enrollment.findMany.mockResolvedValue([]);
      const service = createService(prisma);

      await expect(
        service.saveRecords(actor, 'session_1', {
          records: [
            { studentId: 'student_1', status: AttendanceStatus.PRESENT },
          ],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.attendanceRecord.upsert).not.toHaveBeenCalled();
    });

    it('upserts records within the tenant and returns the refreshed session', async () => {
      const prisma = createPrismaMock();
      prisma.school.findUnique.mockResolvedValue({ isActive: true });
      prisma.attendanceSession.findFirst
        .mockResolvedValueOnce({
          id: 'session_1',
          status: AttendanceSessionStatus.DRAFT,
          classroomId: 'class_1',
          term: { academicYearId: 'year_1' },
        })
        .mockResolvedValueOnce(
          sessionDetailRecord({ records: [recordSummaryRecord()] }),
        );
      prisma.student.findMany.mockResolvedValue([{ id: 'student_1' }]);
      prisma.enrollment.findMany.mockResolvedValue([
        { studentId: 'student_1' },
      ]);
      prisma.attendanceRecord.upsert.mockResolvedValue({ id: 'record_1' });
      mockTransaction(prisma);
      const service = createService(prisma);

      const result = await service.saveRecords(actor, 'session_1', {
        records: [
          {
            studentId: 'student_1',
            status: AttendanceStatus.PRESENT,
            remarks: ' On time ',
          },
        ],
      });

      expect(prisma.attendanceRecord.upsert).toHaveBeenCalledWith({
        where: {
          tenantId_sessionId_studentId: {
            tenantId: TENANT_ID,
            sessionId: 'session_1',
            studentId: 'student_1',
          },
        },
        create: {
          tenantId: TENANT_ID,
          sessionId: 'session_1',
          studentId: 'student_1',
          status: AttendanceStatus.PRESENT,
          remarks: 'On time',
        },
        update: {
          status: AttendanceStatus.PRESENT,
          remarks: 'On time',
        },
        select: { id: true },
      });
      expect(result.records).toHaveLength(1);
    });

    it('rejects duplicate students in the payload', async () => {
      const prisma = createPrismaMock();
      prisma.school.findUnique.mockResolvedValue({ isActive: true });
      prisma.attendanceSession.findFirst.mockResolvedValue({
        id: 'session_1',
        status: AttendanceSessionStatus.DRAFT,
        classroomId: 'class_1',
        term: { academicYearId: 'year_1' },
      });
      const service = createService(prisma);

      await expect(
        service.saveRecords(actor, 'session_1', {
          records: [
            { studentId: 'student_1', status: AttendanceStatus.PRESENT },
            { studentId: 'student_1', status: AttendanceStatus.ABSENT },
          ],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('updateRecord', () => {
    it('blocks updates when the session is locked', async () => {
      const prisma = createPrismaMock();
      prisma.school.findUnique.mockResolvedValue({ isActive: true });
      prisma.attendanceRecord.findFirst.mockResolvedValue({
        id: 'record_1',
        session: { status: AttendanceSessionStatus.LOCKED },
      });
      const service = createService(prisma);

      await expect(
        service.updateRecord(actor, 'record_1', {
          status: AttendanceStatus.ABSENT,
        }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.attendanceRecord.update).not.toHaveBeenCalled();
    });
  });

  describe('getSessionRoster', () => {
    it('merges enrolled students with existing records for the session', async () => {
      const prisma = createPrismaMock();
      prisma.attendanceSession.findFirst.mockResolvedValue({
        id: 'session_1',
        classroomId: 'class_1',
        term: { academicYearId: 'year_1' },
      });
      prisma.enrollment.findMany.mockResolvedValue([
        {
          student: {
            id: 'student_1',
            admissionNumber: 'ADM-001',
            firstName: 'Ada',
            lastName: 'Lovelace',
          },
        },
      ]);
      prisma.attendanceRecord.findMany.mockResolvedValue([
        {
          id: 'record_1',
          studentId: 'student_1',
          status: AttendanceStatus.PRESENT,
          remarks: null,
        },
      ]);
      const service = createService(prisma);

      const result = await service.getSessionRoster(TENANT_ID, 'session_1');

      expect(prisma.enrollment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenantId: TENANT_ID,
            classroomId: 'class_1',
            academicYearId: 'year_1',
            status: 'ACTIVE',
          },
        }),
      );
      expect(result).toEqual([
        {
          student: {
            id: 'student_1',
            admissionNumber: 'ADM-001',
            firstName: 'Ada',
            lastName: 'Lovelace',
          },
          recordId: 'record_1',
          status: AttendanceStatus.PRESENT,
          remarks: null,
        },
      ]);
    });
  });
});
