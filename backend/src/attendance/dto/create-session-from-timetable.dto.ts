import { IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateSessionFromTimetableDto {
  @IsString()
  @IsNotEmpty()
  timetableId: string;

  @IsDateString()
  @IsNotEmpty()
  date: string;

  @IsString()
  @IsOptional()
  period?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  takenById?: string;
}
