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
import { DepartmentService } from './department.service.js';
import { CreateDepartmentDto } from './dto/create-department.dto.js';
import { ListDepartmentsQueryDto } from './dto/list-departments.dto.js';
import { UpdateDepartmentDto } from './dto/update-department.dto.js';
import {
  DEPARTMENT_ADMINS,
  DEPARTMENT_EDITORS,
  DEPARTMENT_READERS,
} from './department.constants.js';

@Controller('departments')
export class DepartmentController {
  constructor(private readonly departmentService: DepartmentService) {}

  @Roles(...DEPARTMENT_READERS)
  @Get()
  list(
    @CurrentUser('tenantId') tenantId: string,
    @Query() query: ListDepartmentsQueryDto,
  ) {
    return this.departmentService.list(tenantId, query);
  }

  @Roles(...DEPARTMENT_READERS)
  @Get(':id')
  get(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') departmentId: string,
  ) {
    return this.departmentService.getById(tenantId, departmentId);
  }

  @Roles(...DEPARTMENT_EDITORS)
  @Post()
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateDepartmentDto,
  ) {
    return this.departmentService.create(actor, dto);
  }

  @Roles(...DEPARTMENT_EDITORS)
  @Patch(':id')
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') departmentId: string,
    @Body() dto: UpdateDepartmentDto,
  ) {
    return this.departmentService.update(actor, departmentId, dto);
  }

  @Roles(...DEPARTMENT_EDITORS)
  @HttpCode(HttpStatus.OK)
  @Patch(':id/set-head')
  setHead(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') departmentId: string,
    @Body('headId') headId: string | null,
  ) {
    return this.departmentService.setHead(actor, departmentId, headId);
  }

  @Roles(...DEPARTMENT_ADMINS)
  @Delete(':id')
  delete(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') departmentId: string,
  ) {
    return this.departmentService.delete(actor, departmentId);
  }
}
