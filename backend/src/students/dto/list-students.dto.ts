import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Gender, StudentStatus } from '@prisma/client';
import { trimString } from '../../common/validation/transforms.js';

export class ListStudentsQueryDto {
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @IsEnum(StudentStatus)
  status?: StudentStatus;

  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  classroomId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  academicYearId?: string;

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;

  @IsOptional()
  @IsIn([
    'createdAt',
    'admissionDate',
    'admissionNumber',
    'firstName',
    'lastName',
  ])
  sortBy?:
    | 'createdAt'
    | 'admissionDate'
    | 'admissionNumber'
    | 'firstName'
    | 'lastName';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';
}
