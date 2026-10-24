import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { UserRole } from '@prisma/client';
import { normalizeEmail, trimString } from '../../common/validation/transforms.js';

export class CreateUserDto {
  @Transform(normalizeEmail)
  @IsEmail()
  @MaxLength(320)
  email: string;

  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName: string;

  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string | null;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  avatarUrl?: string | null;

  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  staffId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  studentId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  guardianId?: string;
}
