import { Module } from '@nestjs/common';
import { TermController } from './term.controller.js';
import { TermService } from './term.service.js';

@Module({
  controllers: [TermController],
  providers: [TermService],
  exports: [TermService],
})
export class TermModule {}
