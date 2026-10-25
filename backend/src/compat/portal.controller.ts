import {
  Body,
  Controller,
  Get,
  Param,
  Put,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { PortalService, type PortalUpdateInput } from './portal.service.js';

export class PortalUpdateDto implements PortalUpdateInput {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  overall_score?: number;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  term?: string;

  @IsOptional()
  @IsArray()
  grades?: unknown[];

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  teacher_remarks?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  guardian_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(320)
  guardian_email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  guardian_phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  guardian_relation?: string;

  @IsOptional()
  @IsArray()
  syllabus_attachments?: unknown[];
}

@Controller('portal')
export class PortalController {
  constructor(private readonly portalService: PortalService) {}

  @Get()
  list(@CurrentUser() actor: AuthenticatedUser) {
    return this.portalService.list(actor.tenantId, actor);
  }

  @Get(':studentId')
  get(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('studentId') studentId: string,
  ) {
    return this.portalService.get(actor.tenantId, studentId, actor);
  }

  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.PRINCIPAL,
    UserRole.VICE_PRINCIPAL,
    UserRole.TEACHER,
  )
  @Put(':studentId')
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('studentId') studentId: string,
    @Body() dto: PortalUpdateDto,
  ) {
    return this.portalService.update(actor.tenantId, studentId, dto, actor);
  }
}
