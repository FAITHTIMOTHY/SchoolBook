import 'reflect-metadata';
import { AttendanceStatus, UserRole } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { ROLES_KEY } from '../auth/decorators/roles.decorator.js';
import { AttendanceController } from './attendance.controller.js';
import type { AttendanceService } from './attendance.service.js';

function createServiceMock() {
  return {
    listSessions: vi.fn(),
    getSession: vi.fn(),
    createSession: vi.fn(),
    updateSession: vi.fn(),
    deleteSession: vi.fn(),
    submitSession: vi.fn(),
    lockSession: vi.fn(),
    getSessionRoster: vi.fn(),
    saveRecords: vi.fn(),
    updateRecord: vi.fn(),
  };
}

function readHandlerRoles(methodName: string) {
  const handler = Object.getOwnPropertyDescriptor(
    AttendanceController.prototype,
    methodName,
  )?.value;

  return handler ? Reflect.getMetadata(ROLES_KEY, handler) : undefined;
}

const actor: AuthenticatedUser = {
  id: 'user_1',
  tenantId: 'tenant_1',
  tenantSlug: 'oakridge',
  email: 'teacher@oakridge.test',
  role: UserRole.TEACHER,
  firstName: 'Ada',
  lastName: 'Teacher',
  avatarUrl: null,
};

describe('AttendanceController', () => {
  it('restricts attendance reads to teaching and leadership roles', () => {
    const expected = [
      UserRole.SUPER_ADMIN,
      UserRole.ADMIN,
      UserRole.PRINCIPAL,
      UserRole.VICE_PRINCIPAL,
      UserRole.TEACHER,
    ];

    expect(readHandlerRoles('listSessions')).toEqual(expected);
    expect(readHandlerRoles('getSession')).toEqual(expected);
    expect(readHandlerRoles('getSessionRoster')).toEqual(expected);
  });

  it('restricts session writes and record entry to teaching roles', () => {
    const expected = [
      UserRole.SUPER_ADMIN,
      UserRole.ADMIN,
      UserRole.PRINCIPAL,
      UserRole.VICE_PRINCIPAL,
      UserRole.TEACHER,
    ];

    expect(readHandlerRoles('createSession')).toEqual(expected);
    expect(readHandlerRoles('updateSession')).toEqual(expected);
    expect(readHandlerRoles('saveRecords')).toEqual(expected);
    expect(readHandlerRoles('updateRecord')).toEqual(expected);
    expect(readHandlerRoles('submitSession')).toEqual(expected);
  });

  it('restricts locking to supervisors and deletion to admins', () => {
    expect(readHandlerRoles('lockSession')).toEqual([
      UserRole.SUPER_ADMIN,
      UserRole.ADMIN,
      UserRole.PRINCIPAL,
      UserRole.VICE_PRINCIPAL,
    ]);
    expect(readHandlerRoles('deleteSession')).toEqual([
      UserRole.SUPER_ADMIN,
      UserRole.ADMIN,
      UserRole.PRINCIPAL,
    ]);
  });

  it('passes the verified tenant id and actor to the service', async () => {
    const service = createServiceMock();
    const controller = new AttendanceController(
      service as unknown as AttendanceService,
    );

    await controller.listSessions('tenant_1', {});
    await controller.createSession(actor, {
      classroomId: 'class_1',
      termId: 'term_1',
      date: '2026-03-02',
    });
    await controller.saveRecords(actor, 'session_1', {
      records: [
        { studentId: 'student_1', status: AttendanceStatus.PRESENT },
      ],
    });

    expect(service.listSessions).toHaveBeenCalledWith('tenant_1', {});
    expect(service.createSession).toHaveBeenCalledWith(actor, expect.any(Object));
    expect(service.saveRecords).toHaveBeenCalledWith(
      actor,
      'session_1',
      expect.any(Object),
    );
  });
});
