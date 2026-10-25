import { IsDateString, IsEnum, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { AttendanceStatus } from '@prisma/client';
import { Type } from 'class-transformer';

export class ListStaffAttendanceQueryDto {
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
  staffId?: string;

  @IsString()
  @IsOptional()
  departmentId?: string;

  @IsDateString()
  @IsOptional()
  dateFrom?: string;

  @IsDateString()
  @IsOptional()
  dateTo?: string;

  @IsEnum(AttendanceStatus)
  @IsOptional()
  status?: AttendanceStatus;

  @IsIn(['date', 'createdAt'])
  @IsOptional()
  sortBy?: 'date' | 'createdAt';

  @IsIn(['asc', 'desc'])
  @IsOptional()
  sortOrder?: 'asc' | 'desc';
}
