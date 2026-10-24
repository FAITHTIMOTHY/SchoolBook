import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
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
import { AttendanceSessionStatus } from '@prisma/client';
import { trimString } from '../../common/validation/transforms.js';

export class ListAttendanceSessionsQueryDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  classroomId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  termId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  subjectId?: string;

  @IsOptional()
  @IsEnum(AttendanceSessionStatus)
  status?: AttendanceSessionStatus;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(32)
  period?: string;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

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
  @IsIn(['date', 'createdAt'])
  sortBy?: 'date' | 'createdAt';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';
}
