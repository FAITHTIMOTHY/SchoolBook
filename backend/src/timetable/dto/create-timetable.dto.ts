import { IsEnum, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';
import { DayOfWeek } from '@prisma/client';

export class CreateTimetableDto {
  @IsString()
  @IsNotEmpty()
  classroomId: string;

  @IsString()
  @IsNotEmpty()
  subjectId: string;

  @IsString()
  @IsOptional()
  teacherId?: string;

  @IsEnum(DayOfWeek)
  @IsNotEmpty()
  dayOfWeek: DayOfWeek;

  @IsString()
  @IsNotEmpty()
  @Matches(/^([0-1]?\d|2[0-3]):([0-5]\d)$/, { message: 'startTime must be in HH:mm format' })
  startTime: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^([0-1]?\d|2[0-3]):([0-5]\d)$/, { message: 'endTime must be in HH:mm format' })
  endTime: string;

  @IsString()
  @IsOptional()
  room?: string;
}
