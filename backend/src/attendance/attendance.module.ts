import { Module } from '@nestjs/common';
import { AttendanceController } from './attendance.controller.js';
import { AttendanceService } from './attendance.service.js';
import { AttendanceReportsService } from './attendance-reports.service.js';

@Module({
  controllers: [AttendanceController],
  providers: [AttendanceService, AttendanceReportsService],
  exports: [AttendanceService, AttendanceReportsService],
})
export class AttendanceModule {}
