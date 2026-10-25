import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ListClassroomsQueryDto {
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

  @IsString()
  @IsOptional()
  classTeacherId?: string;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  gradeLevel?: number;

  @IsIn(['name', 'gradeLevel', 'createdAt'])
  @IsOptional()
  sortBy?: 'name' | 'gradeLevel' | 'createdAt';

  @IsIn(['asc', 'desc'])
  @IsOptional()
  sortOrder?: 'asc' | 'desc';
}
