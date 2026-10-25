import { Module } from '@nestjs/common';
import { AcademicYearController } from './academicyear.controller.js';
import { AcademicYearService } from './academicyear.service.js';

@Module({
  controllers: [AcademicYearController],
  providers: [AcademicYearService],
  exports: [AcademicYearService],
})
export class AcademicYearModule {}
