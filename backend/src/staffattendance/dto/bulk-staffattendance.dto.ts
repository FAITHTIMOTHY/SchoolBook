import { IsArray, IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString, Matches, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { AttendanceStatus } from '@prisma/client';

class BulkStaffAttendanceRecordDto {
  @IsString()
  @IsNotEmpty()
  staffId: string;

  @IsEnum(AttendanceStatus)
  status: AttendanceStatus;

  @IsString()
  @IsOptional()
  @Matches(/^([0-1]?\d|2[0-3]):([0-5]\d)$/, { message: 'checkIn must be in HH:mm format' })
  checkIn?: string;

  @IsString()
  @IsOptional()
  @Matches(/^([0-1]?\d|2[0-3]):([0-5]\d)$/, { message: 'checkOut must be in HH:mm format' })
  checkOut?: string;

  @IsString()
  @IsOptional()
  remarks?: string;
}

export class BulkStaffAttendanceDto {
  @IsDateString()
  @IsNotEmpty()
  date: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkStaffAttendanceRecordDto)
  records: BulkStaffAttendanceRecordDto[];
}
