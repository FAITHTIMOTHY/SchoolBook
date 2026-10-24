import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { GuardianRelationship } from '@prisma/client';

export class LinkGuardianDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  guardianId: string;

  @IsEnum(GuardianRelationship)
  relationship: GuardianRelationship;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}
