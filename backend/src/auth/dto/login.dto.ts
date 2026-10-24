import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  TENANT_SLUG_MAX_LENGTH,
  TENANT_SLUG_PATTERN,
  normalizeTenantSlug,
} from '../../common/validation/tenant-slug.js';

export class LoginDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password: string;

  @Transform(normalizeTenantSlug)
  @IsString()
  @IsNotEmpty()
  @MaxLength(TENANT_SLUG_MAX_LENGTH)
  @Matches(TENANT_SLUG_PATTERN, { message: 'tenantSlug must be a valid slug' })
  tenantSlug: string;
}

export class RegisterDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password: string;

  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  @Transform(normalizeTenantSlug)
  @IsString()
  @IsNotEmpty()
  @MaxLength(TENANT_SLUG_MAX_LENGTH)
  @Matches(TENANT_SLUG_PATTERN, { message: 'tenantSlug must be a valid slug' })
  tenantSlug: string;

  @IsString()
  @IsOptional()
  phone?: string;
}
