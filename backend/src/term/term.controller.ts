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
import { TermService } from './term.service.js';
import { CreateTermDto } from './dto/create-term.dto.js';
import { ListTermsQueryDto } from './dto/list-terms.dto.js';
import { UpdateTermDto } from './dto/update-term.dto.js';
import {
  TERM_ADMINS,
  TERM_EDITORS,
  TERM_READERS,
} from './term.constants.js';

@Controller('terms')
export class TermController {
  constructor(private readonly termService: TermService) {}

  @Roles(...TERM_READERS)
  @Get()
  list(
    @CurrentUser('tenantId') tenantId: string,
    @Query() query: ListTermsQueryDto,
  ) {
    return this.termService.list(tenantId, query);
  }

  @Roles(...TERM_READERS)
  @Get(':id')
  get(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') termId: string,
  ) {
    return this.termService.getById(tenantId, termId);
  }

  @Roles(...TERM_EDITORS)
  @Post()
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateTermDto,
  ) {
    return this.termService.create(actor, dto);
  }

  @Roles(...TERM_EDITORS)
  @Patch(':id')
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') termId: string,
    @Body() dto: UpdateTermDto,
  ) {
    return this.termService.update(actor, termId, dto);
  }

  @Roles(...TERM_EDITORS)
  @HttpCode(HttpStatus.OK)
  @Patch(':id/set-current')
  setCurrent(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') termId: string,
    @Body('isCurrent') isCurrent: boolean,
  ) {
    return this.termService.setCurrent(actor, termId, isCurrent ?? true);
  }

  @Roles(...TERM_ADMINS)
  @Delete(':id')
  delete(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') termId: string,
  ) {
    return this.termService.delete(actor, termId);
  }
}
