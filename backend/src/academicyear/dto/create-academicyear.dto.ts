import { IsBoolean, IsDateString, IsEnum, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';
import { AcademicYearStatus } from '@prisma/client';
import { Type } from 'class-transformer';

export class CreateAcademicYearDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsDateString()
  @IsNotEmpty()
  startDate: string;

  @IsDateString()
  @IsNotEmpty()
  endDate: string;

  @IsEnum(AcademicYearStatus)
  @IsOptional()
  status?: AcademicYearStatus;

  @IsBoolean()
  @IsOptional()
  isCurrent?: boolean;
}
