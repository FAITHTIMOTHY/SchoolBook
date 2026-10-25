import { Module } from '@nestjs/common';
import { StaffAttendanceController } from './staffattendance.controller.js';
import { StaffAttendanceService } from './staffattendance.service.js';

@Module({
  controllers: [StaffAttendanceController],
  providers: [StaffAttendanceService],
  exports: [StaffAttendanceService],
})
export class StaffAttendanceModule {}
