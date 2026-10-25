import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import type { LegacyAttendanceStatus } from './compat.types.js';
import {
  AttendanceCompatService,
  type MarkAttendanceInput,
} from './attendance-compat.service.js';

export class MarkAttendanceDto implements MarkAttendanceInput {
  @IsOptional()
  @IsString()
  memberId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  serviceDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  serviceName?: string;

  @IsOptional()
  @IsIn(['Present', 'Absent'])
  status?: LegacyAttendanceStatus;
}

export class CloseServiceDto {
  @IsOptional()
  @IsString()
  @MaxLength(10)
  serviceDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  serviceName?: string;
}

const ATTENDANCE_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.PRINCIPAL,
  UserRole.VICE_PRINCIPAL,
  UserRole.TEACHER,
];

@Controller('attendance')
export class AttendanceCompatController {
  constructor(private readonly attendanceService: AttendanceCompatService) {}

  @Roles(...ATTENDANCE_ROLES)
  @Get('sheet')
  sheet(
    @CurrentUser() actor: AuthenticatedUser,
    @Query('date') date?: string,
    @Query('serviceName') serviceName?: string,
  ) {
    return this.attendanceService.getSheet(actor.tenantId, date, serviceName);
  }

  @Roles(...ATTENDANCE_ROLES)
  @Post('mark')
  mark(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: MarkAttendanceDto,
  ) {
    return this.attendanceService.mark(actor.tenantId, dto, actor);
  }

  @Roles(...ATTENDANCE_ROLES)
  @Post('close-service')
  closeService(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CloseServiceDto,
  ) {
    return this.attendanceService.closeService(
      actor.tenantId,
      dto.serviceDate,
      dto.serviceName,
      actor,
    );
  }

  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.PRINCIPAL,
    UserRole.VICE_PRINCIPAL,
    UserRole.TEACHER,
  )
  @Get('stats')
  stats(
    @CurrentUser() actor: AuthenticatedUser,
    @Query('type') type?: string,
  ) {
    return this.attendanceService.stats(actor.tenantId, type);
  }
}
