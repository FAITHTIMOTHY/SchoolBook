import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AttendanceCompatController } from './attendance-compat.controller.js';
import { AttendanceCompatService } from './attendance-compat.service.js';
import { FinanceController } from './finance.controller.js';
import { FinanceService } from './finance.service.js';
import { InventoryController } from './inventory.controller.js';
import { InventoryService } from './inventory.service.js';
import { MemberMapperService } from './member-mapper.service.js';
import { MembersController } from './members.controller.js';
import { MembersService } from './members.service.js';
import { MessagingController } from './messaging.controller.js';
import { MessagingService } from './messaging.service.js';
import { PortalController } from './portal.controller.js';
import { PortalService } from './portal.service.js';
import { PublicTenantsController } from './public-tenants.controller.js';
import { UnitsController } from './units.controller.js';
import { UnitsService } from './units.service.js';

@Module({
  imports: [AuthModule],
  controllers: [
    PublicTenantsController,
    MembersController,
    UnitsController,
    AttendanceCompatController,
    InventoryController,
    FinanceController,
    MessagingController,
    PortalController,
  ],
  providers: [
    MemberMapperService,
    MembersService,
    UnitsService,
    AttendanceCompatService,
    InventoryService,
    FinanceService,
    MessagingService,
    PortalService,
  ],
  exports: [MemberMapperService],
})
export class CompatModule {}
