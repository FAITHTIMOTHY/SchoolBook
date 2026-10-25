import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { UnitsService } from './units.service.js';

export class UnitDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  parent_unit_id?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  description?: string;
}

@Controller('units')
export class UnitsController {
  constructor(private readonly unitsService: UnitsService) {}

  @Get()
  list(@CurrentUser() actor: AuthenticatedUser) {
    return this.unitsService.list(actor.tenantId);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.PRINCIPAL)
  @Post()
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: UnitDto,
  ) {
    return this.unitsService.create(dto, actor);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.PRINCIPAL)
  @Delete(':id')
  remove(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.unitsService.remove(id, actor.tenantId);
  }
}
