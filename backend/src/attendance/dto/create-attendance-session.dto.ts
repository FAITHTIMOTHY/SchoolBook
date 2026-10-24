import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { trimString } from '../../common/validation/transforms.js';

export class CreateAttendanceSessionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  classroomId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  termId: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  subjectId?: string | null;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  period?: string;

  @IsDateString()
  date: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  takenById?: string | null;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;
}
