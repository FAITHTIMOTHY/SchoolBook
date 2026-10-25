import { IsBoolean, IsEnum, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { TermStatus } from '@prisma/client';
import { Type } from 'class-transformer';

export class ListTermsQueryDto {
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

  @IsString()
  @IsOptional()
  academicYearId?: string;

  @IsEnum(TermStatus)
  @IsOptional()
  status?: TermStatus;

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
