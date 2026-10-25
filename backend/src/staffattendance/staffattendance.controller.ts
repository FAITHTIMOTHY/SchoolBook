import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { StaffAttendanceService } from './staffattendance.service.js';
import { CreateStaffAttendanceDto } from './dto/create-staffattendance.dto.js';
import { UpdateStaffAttendanceDto } from './dto/update-staffattendance.dto.js';
import { BulkStaffAttendanceDto } from './dto/bulk-staffattendance.dto.js';
import { ListStaffAttendanceQueryDto } from './dto/list-staffattendance.dto.js';
import {
  STAFF_ATTENDANCE_ADMINS,
  STAFF_ATTENDANCE_EDITORS,
  STAFF_ATTENDANCE_READERS,
} from './staffattendance.constants.js';

@Controller('staff-attendance')
export class StaffAttendanceController {
  constructor(private readonly staffAttendanceService: StaffAttendanceService) {}

  @Roles(...STAFF_ATTENDANCE_READERS)
  @Get()
  list(
    @CurrentUser('tenantId') tenantId: string,
    @Query() query: ListStaffAttendanceQueryDto,
  ) {
    return this.staffAttendanceService.list(tenantId, query);
  }

  @Roles(...STAFF_ATTENDANCE_READERS)
  @Get(':id')
  get(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') attendanceId: string,
  ) {
    return this.staffAttendanceService.getById(tenantId, attendanceId);
  }

  @Roles(...STAFF_ATTENDANCE_EDITORS)
  @Post()
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateStaffAttendanceDto,
  ) {
    return this.staffAttendanceService.create(actor, dto);
  }

  @Roles(...STAFF_ATTENDANCE_EDITORS)
  @HttpCode(HttpStatus.OK)
  @Post('bulk')
  bulkUpsert(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: BulkStaffAttendanceDto,
  ) {
    return this.staffAttendanceService.bulkUpsert(actor, dto);
  }

  @Roles(...STAFF_ATTENDANCE_EDITORS)
  @Patch(':id')
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') attendanceId: string,
    @Body() dto: UpdateStaffAttendanceDto,
  ) {
    return this.staffAttendanceService.update(actor, attendanceId, dto);
  }

  @Roles(...STAFF_ATTENDANCE_ADMINS)
  @Delete(':id')
  delete(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') attendanceId: string,
  ) {
    return this.staffAttendanceService.delete(actor, attendanceId);
  }
}
