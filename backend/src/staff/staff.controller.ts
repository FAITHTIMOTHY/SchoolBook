import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { StaffService } from './staff.service.js';
import { CreateStaffDto } from './dto/create-staff.dto.js';
import { ListStaffQueryDto } from './dto/list-staff.dto.js';
import { UpdateStaffDto } from './dto/update-staff.dto.js';
import { UpdateStaffStatusDto } from './dto/update-staff-status.dto.js';
import { LinkUserDto } from './dto/link-user.dto.js';
import {
  STAFF_ADMINS,
  STAFF_CREATORS,
  STAFF_EDITORS,
  STAFF_READERS,
} from './staff.constants.js';

@Controller('staff')
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Roles(...STAFF_READERS)
  @Get()
  list(
    @CurrentUser('tenantId') tenantId: string,
    @Query() query: ListStaffQueryDto,
  ) {
    return this.staffService.list(tenantId, query);
  }

  @Roles(...STAFF_READERS)
  @Get(':id')
  get(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') staffId: string,
  ) {
    return this.staffService.getById(actor.tenantId, staffId, actor);
  }

  @Roles(...STAFF_CREATORS)
  @Post()
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateStaffDto,
  ) {
    return this.staffService.create(actor, dto);
  }

  @Roles(...STAFF_EDITORS)
  @Patch(':id')
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') staffId: string,
    @Body() dto: UpdateStaffDto,
  ) {
    return this.staffService.update(actor, staffId, dto);
  }

  @Roles(...STAFF_ADMINS)
  @HttpCode(HttpStatus.OK)
  @Patch(':id/status')
  setStatus(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') staffId: string,
    @Body() dto: UpdateStaffStatusDto,
  ) {
    return this.staffService.setStatus(actor, staffId, dto.status);
  }

  @Roles(...STAFF_ADMINS)
  @HttpCode(HttpStatus.OK)
  @Post(':id/link-user')
  linkUser(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') staffId: string,
    @Body() dto: LinkUserDto,
  ) {
    return this.staffService.linkUser(actor, staffId, dto.userId);
  }

  @Roles(...STAFF_ADMINS)
  @HttpCode(HttpStatus.OK)
  @Post(':id/unlink-user')
  unlinkUser(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') staffId: string,
  ) {
    return this.staffService.unlinkUser(actor, staffId);
  }

  @Roles(...STAFF_ADMINS)
  @HttpCode(HttpStatus.OK)
  @Post(':id/make-head')
  makeHead(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') staffId: string,
  ) {
    return this.staffService.setDepartmentHead(actor, staffId);
  }

  @Roles(...STAFF_ADMINS)
  @HttpCode(HttpStatus.OK)
  @Post('departments/:departmentId/remove-head')
  removeHead(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('departmentId') departmentId: string,
  ) {
    return this.staffService.removeDepartmentHead(actor, departmentId);
  }
}
