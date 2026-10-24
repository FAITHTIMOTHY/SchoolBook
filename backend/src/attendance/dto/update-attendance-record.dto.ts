import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { AttendanceStatus } from '@prisma/client';
import { trimString } from '../../common/validation/transforms.js';

export class UpdateAttendanceRecordDto {
  @IsOptional()
  @IsEnum(AttendanceStatus)
  status?: AttendanceStatus;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remarks?: string | null;
}
