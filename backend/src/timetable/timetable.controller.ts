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
import { TimetableService } from './timetable.service.js';
import { CreateTimetableDto } from './dto/create-timetable.dto.js';
import { UpdateTimetableDto } from './dto/update-timetable.dto.js';
import { ListTimetableQueryDto } from './dto/list-timetable.dto.js';
import {
  TIMETABLE_ADMINS,
  TIMETABLE_EDITORS,
  TIMETABLE_READERS,
} from '../staffattendance/staffattendance.constants.js';

@Controller('timetable')
export class TimetableController {
  constructor(private readonly timetableService: TimetableService) {}

  @Roles(...TIMETABLE_READERS)
  @Get()
  list(
    @CurrentUser('tenantId') tenantId: string,
    @Query() query: ListTimetableQueryDto,
  ) {
    return this.timetableService.list(tenantId, query);
  }

  @Roles(...TIMETABLE_READERS)
  @Get('teacher/:teacherId')
  getByTeacher(
    @CurrentUser('tenantId') tenantId: string,
    @Param('teacherId') teacherId: string,
  ) {
    return this.timetableService.getByTeacher(tenantId, teacherId);
  }

  @Roles(...TIMETABLE_READERS)
  @Get('me')
  getMyTimetable(
    @CurrentUser() actor: AuthenticatedUser,
    @CurrentUser('tenantId') tenantId: string,
  ) {
    return this.timetableService.getMyTimetable(actor, tenantId);
  }

  @Roles(...TIMETABLE_READERS)
  @Get('classroom/:classroomId')
  getByClassroom(
    @CurrentUser('tenantId') tenantId: string,
    @Param('classroomId') classroomId: string,
  ) {
    return this.timetableService.getByClassroom(tenantId, classroomId);
  }

  @Roles(...TIMETABLE_READERS)
  @Get(':id')
  get(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') timetableId: string,
  ) {
    return this.timetableService.getById(tenantId, timetableId);
  }

  @Roles(...TIMETABLE_EDITORS)
  @Post()
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateTimetableDto,
  ) {
    return this.timetableService.create(actor, dto);
  }

  @Roles(...TIMETABLE_EDITORS)
  @Patch(':id')
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') timetableId: string,
    @Body() dto: UpdateTimetableDto,
  ) {
    return this.timetableService.update(actor, timetableId, dto);
  }

  @Roles(...TIMETABLE_ADMINS)
  @Delete(':id')
  delete(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') timetableId: string,
  ) {
    return this.timetableService.delete(actor, timetableId);
  }
}
