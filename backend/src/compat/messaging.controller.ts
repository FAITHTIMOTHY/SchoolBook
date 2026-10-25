import { Body, Controller, Get, Post } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import {
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import type { LegacyBroadcastCategory } from './compat.types.js';
import { MessagingService, type BroadcastInput } from './messaging.service.js';

export class BroadcastDto implements BroadcastInput {
  @IsOptional()
  @IsIn(['all', 'unit', 'first-timers'])
  target?: 'all' | 'unit' | 'first-timers';

  @IsOptional()
  @IsString()
  @MaxLength(64)
  unitId?: string | null;

  @IsOptional()
  @IsIn(['assignment', 'test', 'impromptu', 'curriculum'])
  category?: LegacyBroadcastCategory;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  message?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  event_date?: string;

  @IsOptional()
  @IsObject()
  attachment?: Record<string, unknown> | null;

  @IsOptional()
  @IsBoolean()
  bulk_mail?: boolean;
}

@Controller('messaging')
export class MessagingController {
  constructor(private readonly messagingService: MessagingService) {}

  @Get()
  list(@CurrentUser() actor: AuthenticatedUser) {
    return this.messagingService.list(actor.tenantId, actor);
  }

  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.PRINCIPAL,
    UserRole.VICE_PRINCIPAL,
    UserRole.TEACHER,
  )
  @Post('send')
  send(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: BroadcastDto,
  ) {
    return this.messagingService.send(dto, actor);
  }
}
