import { Module } from '@nestjs/common';
import { ClassroomController } from './classroom.controller.js';
import { ClassroomService } from './classroom.service.js';

@Module({
  controllers: [ClassroomController],
  providers: [ClassroomService],
  exports: [ClassroomService],
})
export class ClassroomModule {}
