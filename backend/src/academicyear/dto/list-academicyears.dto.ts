import { IsBoolean, IsEnum, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { AcademicYearStatus } from '@prisma/client';
import { Type } from 'class-transformer';

export class ListAcademicYearsQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  pageSize?: number;

  @IsString()
  @IsOptional()
  search?: string;

  @IsEnum(AcademicYearStatus)
  @IsOptional()
  status?: AcademicYearStatus;

  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  isCurrent?: boolean;

  @IsIn(['name', 'startDate', 'endDate', 'createdAt'])
  @IsOptional()
  sortBy?: 'name' | 'startDate' | 'endDate' | 'createdAt';

  @IsIn(['asc', 'desc'])
  @IsOptional()
  sortOrder?: 'asc' | 'desc';
}
