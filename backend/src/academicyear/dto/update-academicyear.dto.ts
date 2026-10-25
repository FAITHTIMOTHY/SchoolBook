import { PartialType } from '@nestjs/mapped-types';
import { CreateAcademicYearDto } from './create-academicyear.dto.js';

export class UpdateAcademicYearDto extends PartialType(CreateAcademicYearDto) {}
