import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { UserRole } from '@prisma/client';
import { normalizeEmail, trimString } from '../../common/validation/transforms.js';

export class UpdateUserDto {
  @Transform(normalizeEmail)
  @IsOptional()
  @IsEmail()
  @MaxLength(320)
  email?: string;

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
  @MaxLength(32)
  phone?: string | null;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  avatarUrl?: string | null;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}
