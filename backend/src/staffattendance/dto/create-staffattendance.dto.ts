import { IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';
import { AttendanceStatus } from '@prisma/client';

export class CreateStaffAttendanceDto {
  @IsString()
  @IsNotEmpty()
  staffId: string;

  @IsDateString()
  @IsNotEmpty()
  date: string;

  @IsEnum(AttendanceStatus)
  @IsOptional()
  status?: AttendanceStatus;

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
