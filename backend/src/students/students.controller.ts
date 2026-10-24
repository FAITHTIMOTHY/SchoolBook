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
import { CreateStudentDto } from './dto/create-student.dto.js';
import { LinkGuardianDto } from './dto/link-guardian.dto.js';
import { ListStudentsQueryDto } from './dto/list-students.dto.js';
import { UpdateStudentDto } from './dto/update-student.dto.js';
import { StudentsService } from './students.service.js';

const STUDENT_READERS = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.PRINCIPAL,
  UserRole.VICE_PRINCIPAL,
  UserRole.TEACHER,
  UserRole.ACCOUNTANT,
  UserRole.LIBRARIAN,
];

const STUDENT_MANAGERS = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.PRINCIPAL,
];

const GUARDIAN_MANAGERS = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.PRINCIPAL,
  UserRole.VICE_PRINCIPAL,
];

@Controller('students')
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Get('me')
  getMe(@CurrentUser() actor: AuthenticatedUser) {
    return this.studentsService.getMe(actor.tenantId, actor.id);
  }

  @Roles(...STUDENT_READERS)
  @Get()
  list(
    @CurrentUser('tenantId') tenantId: string,
    @Query() query: ListStudentsQueryDto,
  ) {
    return this.studentsService.list(tenantId, query);
  }

  @Roles(...STUDENT_READERS)
  @Get(':id')
  getOne(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') studentId: string,
  ) {
    return this.studentsService.getById(tenantId, studentId);
  }

  @Roles(...STUDENT_READERS)
  @Get(':id/guardians')
  getGuardians(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') studentId: string,
  ) {
    return this.studentsService.getGuardians(tenantId, studentId);
  }

  @Roles(...STUDENT_MANAGERS)
  @Post()
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateStudentDto,
  ) {
    return this.studentsService.create(actor, dto);
  }

  @Roles(...STUDENT_MANAGERS)
  @Patch(':id')
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') studentId: string,
    @Body() dto: UpdateStudentDto,
  ) {
    return this.studentsService.update(actor, studentId, dto);
  }

  @Roles(...STUDENT_MANAGERS)
  @Delete(':id')
  remove(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') studentId: string,
  ) {
    return this.studentsService.remove(actor, studentId);
  }

  @Roles(...GUARDIAN_MANAGERS)
  @Post(':id/guardians')
  linkGuardian(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') studentId: string,
    @Body() dto: LinkGuardianDto,
  ) {
    return this.studentsService.linkGuardian(actor, studentId, dto);
  }

  @Roles(...GUARDIAN_MANAGERS)
  @Delete(':id/guardians/:guardianId')
  unlinkGuardian(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') studentId: string,
    @Param('guardianId') guardianId: string,
  ) {
    return this.studentsService.unlinkGuardian(actor, studentId, guardianId);
  }
}
