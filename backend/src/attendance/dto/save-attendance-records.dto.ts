import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { AttendanceStatus } from '@prisma/client';
import { trimString } from '../../common/validation/transforms.js';

export class AttendanceRecordInputDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  studentId: string;

  @IsEnum(AttendanceStatus)
  status: AttendanceStatus;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remarks?: string | null;
}

export class SaveAttendanceRecordsDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => AttendanceRecordInputDto)
  records: AttendanceRecordInputDto[];
}
