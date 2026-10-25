import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
} from '@nestjs/common';
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
import type { LegacyInventoryStatus } from './compat.types.js';
import { InventoryService, type InventoryInput } from './inventory.service.js';

export class InventoryDto implements InventoryInput {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  item_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsIn(['Active', 'Faulty', 'Unavailable'])
  status?: LegacyInventoryStatus;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  unit_id?: string | null;
}

const INVENTORY_EDIT_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.PRINCIPAL,
  UserRole.VICE_PRINCIPAL,
  UserRole.TEACHER,
  UserRole.LIBRARIAN,
];

@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  list(@CurrentUser() actor: AuthenticatedUser) {
    return this.inventoryService.list(actor.tenantId);
  }

  @Roles(...INVENTORY_EDIT_ROLES)
  @Post()
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: InventoryDto,
  ) {
    return this.inventoryService.create(dto, actor);
  }

  @Roles(...INVENTORY_EDIT_ROLES)
  @Put(':id')
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: InventoryDto,
  ) {
    return this.inventoryService.update(id, dto, actor);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.PRINCIPAL)
  @Delete(':id')
  remove(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.inventoryService.remove(id, actor.tenantId);
  }
}
