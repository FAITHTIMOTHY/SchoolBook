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
import { SubjectService } from './subject.service.js';
import { CreateSubjectDto } from './dto/create-subject.dto.js';
import { ListSubjectsQueryDto } from './dto/list-subjects.dto.js';
import { UpdateSubjectDto } from './dto/update-subject.dto.js';
import {
  SUBJECT_ADMINS,
  SUBJECT_EDITORS,
  SUBJECT_READERS,
} from './subject.constants.js';

@Controller('subjects')
export class SubjectController {
  constructor(private readonly subjectService: SubjectService) {}

  @Roles(...SUBJECT_READERS)
  @Get()
  list(
    @CurrentUser('tenantId') tenantId: string,
    @Query() query: ListSubjectsQueryDto,
  ) {
    return this.subjectService.list(tenantId, query);
  }

  @Roles(...SUBJECT_READERS)
  @Get(':id')
  get(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') subjectId: string,
  ) {
    return this.subjectService.getById(tenantId, subjectId);
  }

  @Roles(...SUBJECT_EDITORS)
  @Post()
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateSubjectDto,
  ) {
    return this.subjectService.create(actor, dto);
  }

  @Roles(...SUBJECT_EDITORS)
  @Patch(':id')
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') subjectId: string,
    @Body() dto: UpdateSubjectDto,
  ) {
    return this.subjectService.update(actor, subjectId, dto);
  }

  @Roles(...SUBJECT_EDITORS)
  @HttpCode(HttpStatus.OK)
  @Patch(':id/set-department')
  setDepartment(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') subjectId: string,
    @Body('departmentId') departmentId: string | null,
  ) {
    return this.subjectService.setDepartment(actor, subjectId, departmentId);
  }

  @Roles(...SUBJECT_ADMINS)
  @Delete(':id')
  delete(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') subjectId: string,
  ) {
    return this.subjectService.delete(actor, subjectId);
  }
}
