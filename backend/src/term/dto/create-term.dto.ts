import { IsBoolean, IsDateString, IsEnum, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';
import { TermStatus } from '@prisma/client';
import { Type } from 'class-transformer';

export class CreateTermDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  academicYearId: string;

  @IsDateString()
  @IsNotEmpty()
  startDate: string;

  @IsDateString()
  @IsNotEmpty()
  endDate: string;

  @IsEnum(TermStatus)
  @IsOptional()
  status?: TermStatus;

  @IsBoolean()
  @IsOptional()
  isCurrent?: boolean;
}
