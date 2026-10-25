import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { StaffStatus } from '@prisma/client';

export class UpdateStaffStatusDto {
  @IsEnum(StaffStatus)
  @IsNotEmpty()
  status: StaffStatus;
}
