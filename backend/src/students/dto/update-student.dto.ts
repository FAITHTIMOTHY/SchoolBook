import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { Gender, StudentStatus } from '@prisma/client';
import {
  normalizeEmail,
  trimString,
} from '../../common/validation/transforms.js';

export class UpdateStudentDto {
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  admissionNumber?: string;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName?: string;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName?: string;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  otherNames?: string | null;

  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender | null;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string | null;

  @IsOptional()
  @IsDateString()
  admissionDate?: string;

  @IsOptional()
  @IsEnum(StudentStatus)
  status?: StudentStatus;

  @Transform(normalizeEmail)
  @IsOptional()
  @IsEmail()
  @MaxLength(320)
  email?: string | null;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string | null;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string | null;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  photoUrl?: string | null;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(16)
  bloodGroup?: string | null;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  allergies?: string | null;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  userId?: string | null;
}
