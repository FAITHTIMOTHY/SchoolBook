import { IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateClassroomDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  code?: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  gradeLevel?: number;

  @IsString()
  @IsOptional()
  section?: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  capacity?: number;

  @IsString()
  @IsOptional()
  room?: string;

  @IsString()
  @IsNotEmpty()
  academicYearId: string;

  @IsString()
  @IsOptional()
  classTeacherId?: string;
}
