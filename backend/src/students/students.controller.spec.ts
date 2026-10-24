import 'reflect-metadata';
import { GuardianRelationship, UserRole } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { ROLES_KEY } from '../auth/decorators/roles.decorator.js';
import { StudentsController } from './students.controller.js';
import type { StudentsService } from './students.service.js';

function createServiceMock() {
  return {
    list: vi.fn(),
    getById: vi.fn(),
    getMe: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    getGuardians: vi.fn(),
    linkGuardian: vi.fn(),
    unlinkGuardian: vi.fn(),
  };
}

function readHandlerRoles(methodName: string) {
  const handler = Object.getOwnPropertyDescriptor(
    StudentsController.prototype,
    methodName,
  )?.value;

  return handler ? Reflect.getMetadata(ROLES_KEY, handler) : undefined;
}

const actor: AuthenticatedUser = {
  id: 'admin_1',
  tenantId: 'tenant_1',
  tenantSlug: 'oakridge',
  email: 'admin@oakridge.test',
  role: UserRole.ADMIN,
  firstName: 'Ada',
  lastName: 'Admin',
  avatarUrl: null,
};

describe('StudentsController', () => {
  it('restricts student reads to staff roles', () => {
    const expected = [
      UserRole.SUPER_ADMIN,
      UserRole.ADMIN,
      UserRole.PRINCIPAL,
      UserRole.VICE_PRINCIPAL,
      UserRole.TEACHER,
      UserRole.ACCOUNTANT,
      UserRole.LIBRARIAN,
    ];

    expect(readHandlerRoles('list')).toEqual(expected);
    expect(readHandlerRoles('getOne')).toEqual(expected);
    expect(readHandlerRoles('getGuardians')).toEqual(expected);
  });

  it('restricts student mutations to leadership roles', () => {
    const expected = [
      UserRole.SUPER_ADMIN,
      UserRole.ADMIN,
      UserRole.PRINCIPAL,
    ];

    expect(readHandlerRoles('create')).toEqual(expected);
    expect(readHandlerRoles('update')).toEqual(expected);
    expect(readHandlerRoles('remove')).toEqual(expected);
  });

  it('restricts guardian management to leadership roles', () => {
    const expected = [
      UserRole.SUPER_ADMIN,
      UserRole.ADMIN,
      UserRole.PRINCIPAL,
      UserRole.VICE_PRINCIPAL,
    ];

    expect(readHandlerRoles('linkGuardian')).toEqual(expected);
    expect(readHandlerRoles('unlinkGuardian')).toEqual(expected);
  });

  it('leaves the self-service student route open to authenticated users', () => {
    expect(readHandlerRoles('getMe')).toBeUndefined();
  });

  it('passes the verified tenant id and actor to the service', async () => {
    const service = createServiceMock();
    const controller = new StudentsController(
      service as unknown as StudentsService,
    );

    await controller.getMe(actor);
    await controller.list('tenant_1', {});
    await controller.create(actor, {
      admissionNumber: 'ADM-001',
      firstName: 'Ada',
      lastName: 'Lovelace',
      admissionDate: '2026-01-05',
    });
    await controller.linkGuardian(actor, 'student_1', {
      guardianId: 'guardian_1',
      relationship: GuardianRelationship.MOTHER,
    });

    expect(service.getMe).toHaveBeenCalledWith('tenant_1', 'admin_1');
    expect(service.list).toHaveBeenCalledWith('tenant_1', {});
    expect(service.create).toHaveBeenCalledWith(actor, expect.any(Object));
    expect(service.linkGuardian).toHaveBeenCalledWith(
      actor,
      'student_1',
      expect.any(Object),
    );
  });
});
