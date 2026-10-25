import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import type { LegacyMemberStatus, LegacyRole } from './compat.types.js';
import { MembersService } from './members.service.js';

export class MemberDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsIn(['Principal', 'Teacher', 'Counselor', 'Student'])
  role?: LegacyRole;

  @ValidateIf((value: MemberDto) => value.email !== undefined && value.email !== '')
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  profile_picture_url?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  dob_month?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(31)
  dob_day?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  position?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  unit_id?: string | null;

  @IsOptional()
  @IsIn(['Active', 'Inactive'])
  status?: LegacyMemberStatus;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  academic_score?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  guardian_name?: string;

  @ValidateIf(
    (value: MemberDto) =>
      value.guardian_email !== undefined && value.guardian_email !== '',
  )
  @IsEmail()
  guardian_email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  guardian_phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  office_location?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  office_hours?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  bio?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  specialization?: string;
}

@Controller('members')
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @Get()
  list(
    @CurrentUser() actor: AuthenticatedUser,
    @Query('search') search?: string,
    @Query('role') role?: string,
    @Query('status') status?: string,
  ) {
    return this.membersService.list(
      actor.tenantId,
      { search, role, status },
      actor,
    );
  }

  @Get('me')
  me(@CurrentUser() actor: AuthenticatedUser) {
    return this.membersService.me(actor);
  }

  @Get(':id')
  get(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.membersService.get(actor.tenantId, id, actor);
  }

  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.PRINCIPAL,
    UserRole.VICE_PRINCIPAL,
  )
  @Post()
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: MemberDto,
  ) {
    return this.membersService.create(dto, actor);
  }

  @Put(':id')
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: MemberDto,
  ) {
    return this.membersService.update(id, dto, actor);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.PRINCIPAL)
  @Delete(':id')
  remove(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.membersService.remove(id, actor);
  }
}
