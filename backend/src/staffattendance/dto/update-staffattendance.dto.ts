import { PartialType } from '@nestjs/mapped-types';
import { CreateStaffAttendanceDto } from './create-staffattendance.dto.js';

export class UpdateStaffAttendanceDto extends PartialType(CreateStaffAttendanceDto) {}
