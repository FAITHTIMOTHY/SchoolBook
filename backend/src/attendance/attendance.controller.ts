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
import { UserRole } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { AttendanceService } from './attendance.service.js';
import { CreateAttendanceSessionDto } from './dto/create-attendance-session.dto.js';
import { ListAttendanceSessionsQueryDto } from './dto/list-attendance-sessions.dto.js';
import { SaveAttendanceRecordsDto } from './dto/save-attendance-records.dto.js';
import { UpdateAttendanceRecordDto } from './dto/update-attendance-record.dto.js';
import { UpdateAttendanceSessionDto } from './dto/update-attendance-session.dto.js';

const ATTENDANCE_READERS = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.PRINCIPAL,
  UserRole.VICE_PRINCIPAL,
  UserRole.TEACHER,
];

const ATTENDANCE_EDITORS = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.PRINCIPAL,
  UserRole.VICE_PRINCIPAL,
  UserRole.TEACHER,
];

const ATTENDANCE_SUPERVISORS = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.PRINCIPAL,
  UserRole.VICE_PRINCIPAL,
];

const ATTENDANCE_ADMINS = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.PRINCIPAL,
];

@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Roles(...ATTENDANCE_READERS)
  @Get('sessions')
  listSessions(
    @CurrentUser('tenantId') tenantId: string,
    @Query() query: ListAttendanceSessionsQueryDto,
  ) {
    return this.attendanceService.listSessions(tenantId, query);
  }

  @Roles(...ATTENDANCE_EDITORS)
  @Post('sessions')
  createSession(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateAttendanceSessionDto,
  ) {
    return this.attendanceService.createSession(actor, dto);
  }

  @Roles(...ATTENDANCE_READERS)
  @Get('sessions/:id')
  getSession(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') sessionId: string,
  ) {
    return this.attendanceService.getSession(tenantId, sessionId);
  }

  @Roles(...ATTENDANCE_EDITORS)
  @Patch('sessions/:id')
  updateSession(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') sessionId: string,
    @Body() dto: UpdateAttendanceSessionDto,
  ) {
    return this.attendanceService.updateSession(actor, sessionId, dto);
  }

  @Roles(...ATTENDANCE_ADMINS)
  @Delete('sessions/:id')
  deleteSession(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') sessionId: string,
  ) {
    return this.attendanceService.deleteSession(actor, sessionId);
  }

  @Roles(...ATTENDANCE_EDITORS)
  @HttpCode(HttpStatus.OK)
  @Post('sessions/:id/submit')
  submitSession(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') sessionId: string,
  ) {
    return this.attendanceService.submitSession(actor, sessionId);
  }

  @Roles(...ATTENDANCE_SUPERVISORS)
  @HttpCode(HttpStatus.OK)
  @Post('sessions/:id/lock')
  lockSession(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') sessionId: string,
  ) {
    return this.attendanceService.lockSession(actor, sessionId);
  }

  @Roles(...ATTENDANCE_READERS)
  @Get('sessions/:id/roster')
  getSessionRoster(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') sessionId: string,
  ) {
    return this.attendanceService.getSessionRoster(tenantId, sessionId);
  }

  @Roles(...ATTENDANCE_EDITORS)
  @HttpCode(HttpStatus.OK)
  @Post('sessions/:id/records')
  saveRecords(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') sessionId: string,
    @Body() dto: SaveAttendanceRecordsDto,
  ) {
    return this.attendanceService.saveRecords(actor, sessionId, dto);
  }

  @Roles(...ATTENDANCE_EDITORS)
  @Patch('records/:id')
  updateRecord(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') recordId: string,
    @Body() dto: UpdateAttendanceRecordDto,
  ) {
    return this.attendanceService.updateRecord(actor, recordId, dto);
  }
}
