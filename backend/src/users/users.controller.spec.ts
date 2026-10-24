import 'reflect-metadata';
import { UserRole } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { ROLES_KEY } from '../auth/decorators/roles.decorator.js';
import { UsersController } from './users.controller.js';
import type { UsersService } from './users.service.js';

function createServiceMock() {
  return {
    list: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateSelf: vi.fn(),
    setActive: vi.fn(),
    remove: vi.fn(),
  };
}

function readHandlerRoles(methodName: string) {
  const handler = Object.getOwnPropertyDescriptor(
    UsersController.prototype,
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

describe('UsersController', () => {
  it('restricts user listing to leadership roles', () => {
    expect(readHandlerRoles('list')).toEqual([
      UserRole.SUPER_ADMIN,
      UserRole.ADMIN,
      UserRole.PRINCIPAL,
      UserRole.VICE_PRINCIPAL,
    ]);
    expect(readHandlerRoles('getOne')).toEqual(readHandlerRoles('list'));
  });

  it('restricts user creation to managers', () => {
    expect(readHandlerRoles('create')).toEqual([
      UserRole.SUPER_ADMIN,
      UserRole.ADMIN,
      UserRole.PRINCIPAL,
    ]);
    expect(readHandlerRoles('update')).toEqual(readHandlerRoles('create'));
  });

  it('restricts status changes and deletes to tenant admins', () => {
    expect(readHandlerRoles('setStatus')).toEqual([
      UserRole.SUPER_ADMIN,
      UserRole.ADMIN,
    ]);
    expect(readHandlerRoles('remove')).toEqual(readHandlerRoles('setStatus'));
  });

  it('leaves self-service profile routes open to any authenticated role', () => {
    expect(readHandlerRoles('getMe')).toBeUndefined();
    expect(readHandlerRoles('updateMe')).toBeUndefined();
  });

  it('passes the verified tenant id and actor to the service', async () => {
    const service = createServiceMock();
    const controller = new UsersController(
      service as unknown as UsersService,
    );

    await controller.getMe(actor);
    await controller.list('tenant_1', {});
    await controller.create(actor, {
      email: 'new@oakridge.test',
      firstName: 'New',
      lastName: 'User',
    });

    expect(service.getById).toHaveBeenCalledWith('tenant_1', 'admin_1');
    expect(service.list).toHaveBeenCalledWith('tenant_1', {});
    expect(service.create).toHaveBeenCalledWith(actor, expect.any(Object));
  });
});
