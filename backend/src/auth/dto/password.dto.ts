import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
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

export class ForgotPasswordDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @Transform(normalizeTenantSlug)
  @IsString()
  @IsNotEmpty()
  @MaxLength(TENANT_SLUG_MAX_LENGTH)
  @Matches(TENANT_SLUG_PATTERN, { message: 'tenantSlug must be a valid slug' })
  tenantSlug: string;
}

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @Transform(normalizeTenantSlug)
  @IsString()
  @IsNotEmpty()
  @MaxLength(TENANT_SLUG_MAX_LENGTH)
  @Matches(TENANT_SLUG_PATTERN, { message: 'tenantSlug must be a valid slug' })
  tenantSlug: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password: string;
}

export class VerifyEmailDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @Transform(normalizeTenantSlug)
  @IsString()
  @IsNotEmpty()
  @MaxLength(TENANT_SLUG_MAX_LENGTH)
  @Matches(TENANT_SLUG_PATTERN, { message: 'tenantSlug must be a valid slug' })
  tenantSlug: string;
}
