import { PartialType } from '@nestjs/mapped-types';
import { CreateTimetableDto } from './create-timetable.dto.js';

export class UpdateTimetableDto extends PartialType(CreateTimetableDto) {}
