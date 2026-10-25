import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { ListUsersQueryDto } from './dto/list-users.dto.js';
import { UpdateOwnProfileDto } from './dto/update-own-profile.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { UpdateUserStatusDto } from './dto/update-user-status.dto.js';
import { UsersService } from './users.service.js';

const USER_READERS = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.PRINCIPAL,
  UserRole.VICE_PRINCIPAL,
];

const USER_MANAGERS = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.PRINCIPAL,
  UserRole.VICE_PRINCIPAL,
];

const USER_ADMINS = [UserRole.SUPER_ADMIN, UserRole.ADMIN];

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  getMe(@CurrentUser() actor: AuthenticatedUser) {
    return this.usersService.getById(actor.tenantId, actor.id);
  }

  @Patch('me')
  updateMe(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: UpdateOwnProfileDto,
  ) {
    return this.usersService.updateSelf(actor.tenantId, actor.id, dto);
  }

  @Roles(...USER_READERS)
  @Get()
  list(
    @CurrentUser('tenantId') tenantId: string,
    @Query() query: ListUsersQueryDto,
  ) {
    return this.usersService.list(tenantId, query);
  }

  @Roles(...USER_READERS)
  @Get(':id')
  getOne(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') userId: string,
  ) {
    return this.usersService.getById(tenantId, userId);
  }

  @Roles(...USER_MANAGERS)
  @Post()
  create(@CurrentUser() actor: AuthenticatedUser, @Body() dto: CreateUserDto) {
    return this.usersService.create(actor, dto);
  }

  @Roles(...USER_MANAGERS)
  @Patch(':id')
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') userId: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.update(actor, userId, dto);
  }

  @Roles(...USER_ADMINS)
  @Patch(':id/status')
  setStatus(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') userId: string,
    @Body() dto: UpdateUserStatusDto,
  ) {
    return this.usersService.setActive(actor, userId, dto.isActive);
  }

  @Roles(...USER_ADMINS)
  @Delete(':id')
  remove(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') userId: string,
  ) {
    return this.usersService.remove(actor, userId);
  }
}
