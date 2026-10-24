import { Controller, Get } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { TenantService } from './tenant.service.js';

@Controller('tenants')
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Get('current')
  getCurrentTenant(@CurrentUser('tenantId') tenantId: string) {
    return this.tenantService.getCurrentTenant(tenantId);
  }

  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.PRINCIPAL,
    UserRole.VICE_PRINCIPAL,
    UserRole.ACCOUNTANT,
  )
  @Get('current/overview')
  getCurrentTenantOverview(@CurrentUser('tenantId') tenantId: string) {
    return this.tenantService.getTenantOverview(tenantId);
  }
}
