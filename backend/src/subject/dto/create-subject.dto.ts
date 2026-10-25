import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSubjectDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsOptional()
  description?: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  credits?: number;

  @IsBoolean()
  @IsOptional()
  isCore?: boolean;

  @IsString()
  @IsOptional()
  departmentId?: string;
}
