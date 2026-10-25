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
import { ClassroomService } from './classroom.service.js';
import { CreateClassroomDto } from './dto/create-classroom.dto.js';
import { ListClassroomsQueryDto } from './dto/list-classrooms.dto.js';
import { UpdateClassroomDto } from './dto/update-classroom.dto.js';
import {
  CLASSROOM_ADMINS,
  CLASSROOM_EDITORS,
  CLASSROOM_READERS,
} from './classroom.constants.js';

@Controller('classrooms')
export class ClassroomController {
  constructor(private readonly classroomService: ClassroomService) {}

  @Roles(...CLASSROOM_READERS)
  @Get()
  list(
    @CurrentUser('tenantId') tenantId: string,
    @Query() query: ListClassroomsQueryDto,
  ) {
    return this.classroomService.list(tenantId, query);
  }

  @Roles(...CLASSROOM_READERS)
  @Get(':id')
  get(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') classroomId: string,
  ) {
    return this.classroomService.getById(tenantId, classroomId);
  }

  @Roles(...CLASSROOM_EDITORS)
  @Post()
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateClassroomDto,
  ) {
    return this.classroomService.create(actor, dto);
  }

  @Roles(...CLASSROOM_EDITORS)
  @Patch(':id')
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') classroomId: string,
    @Body() dto: UpdateClassroomDto,
  ) {
    return this.classroomService.update(actor, classroomId, dto);
  }

  @Roles(...CLASSROOM_EDITORS)
  @HttpCode(HttpStatus.OK)
  @Patch(':id/assign-teacher')
  assignTeacher(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') classroomId: string,
    @Body('classTeacherId') classTeacherId: string | null,
  ) {
    return this.classroomService.assignClassTeacher(actor, classroomId, classTeacherId);
  }

  @Roles(...CLASSROOM_ADMINS)
  @Delete(':id')
  delete(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') classroomId: string,
  ) {
    return this.classroomService.delete(actor, classroomId);
  }
}
