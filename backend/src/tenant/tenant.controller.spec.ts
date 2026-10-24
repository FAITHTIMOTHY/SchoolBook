import 'reflect-metadata';
import { UserRole } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { ROLES_KEY } from '../auth/decorators/roles.decorator.js';
import { TenantController } from './tenant.controller.js';
import type { TenantService } from './tenant.service.js';

function createServiceMock() {
  return {
    getCurrentTenant: vi.fn(),
    getTenantOverview: vi.fn(),
  };
}

function readHandlerRoles(methodName: string) {
  const handler = Object.getOwnPropertyDescriptor(
    TenantController.prototype,
    methodName,
  )?.value;

  return handler ? Reflect.getMetadata(ROLES_KEY, handler) : undefined;
}

describe('TenantController', () => {
  it('restricts the overview endpoint to leadership roles', () => {
    const roles = readHandlerRoles('getCurrentTenantOverview');

    expect(roles).toEqual([
      UserRole.SUPER_ADMIN,
      UserRole.ADMIN,
      UserRole.PRINCIPAL,
      UserRole.VICE_PRINCIPAL,
      UserRole.ACCOUNTANT,
    ]);
  });

  it('leaves the current tenant endpoint available to any authenticated role', () => {
    const roles = readHandlerRoles('getCurrentTenant');

    expect(roles).toBeUndefined();
  });

  it('passes the verified tenant id to the service', async () => {
    const service = createServiceMock();
    const controller = new TenantController(
      service as unknown as TenantService,
    );

    await controller.getCurrentTenant('tenant_1');
    await controller.getCurrentTenantOverview('tenant_1');

    expect(service.getCurrentTenant).toHaveBeenCalledWith('tenant_1');
    expect(service.getTenantOverview).toHaveBeenCalledWith('tenant_1');
  });
});
