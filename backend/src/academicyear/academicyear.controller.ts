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
import { AcademicYearService } from './academicyear.service.js';
import { CreateAcademicYearDto } from './dto/create-academicyear.dto.js';
import { ListAcademicYearsQueryDto } from './dto/list-academicyears.dto.js';
import { UpdateAcademicYearDto } from './dto/update-academicyear.dto.js';
import {
  ACADEMICYEAR_ADMINS,
  ACADEMICYEAR_EDITORS,
  ACADEMICYEAR_READERS,
} from './academicyear.constants.js';

@Controller('academic-years')
export class AcademicYearController {
  constructor(private readonly academicYearService: AcademicYearService) {}

  @Roles(...ACADEMICYEAR_READERS)
  @Get()
  list(
    @CurrentUser('tenantId') tenantId: string,
    @Query() query: ListAcademicYearsQueryDto,
  ) {
    return this.academicYearService.list(tenantId, query);
  }

  @Roles(...ACADEMICYEAR_READERS)
  @Get(':id')
  get(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') academicYearId: string,
  ) {
    return this.academicYearService.getById(tenantId, academicYearId);
  }

  @Roles(...ACADEMICYEAR_EDITORS)
  @Post()
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateAcademicYearDto,
  ) {
    return this.academicYearService.create(actor, dto);
  }

  @Roles(...ACADEMICYEAR_EDITORS)
  @Patch(':id')
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') academicYearId: string,
    @Body() dto: UpdateAcademicYearDto,
  ) {
    return this.academicYearService.update(actor, academicYearId, dto);
  }

  @Roles(...ACADEMICYEAR_EDITORS)
  @HttpCode(HttpStatus.OK)
  @Patch(':id/set-current')
  setCurrent(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') academicYearId: string,
    @Body('isCurrent') isCurrent: boolean,
  ) {
    return this.academicYearService.setCurrent(actor, academicYearId, isCurrent ?? true);
  }

  @Roles(...ACADEMICYEAR_ADMINS)
  @Delete(':id')
  delete(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') academicYearId: string,
  ) {
    return this.academicYearService.delete(actor, academicYearId);
  }
}
