import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { DayOfWeek, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  CreateTimetableInput,
  ListTimetableQuery,
  PaginatedTimetable,
  TimetableActorContext,
  TimetableSummary,
  UpdateTimetableInput,
} from '../staffattendance/staffattendance.types.js';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

const timetableSummarySelect = {
  id: true,
  tenantId: true,
  classroomId: true,
  subjectId: true,
  teacherId: true,
  dayOfWeek: true,
  startTime: true,
  endTime: true,
  room: true,
  createdAt: true,
  updatedAt: true,
  classroom: {
    select: {
      id: true,
      name: true,
      code: true,
      gradeLevel: true,
    },
  },
  subject: {
    select: {
      id: true,
      name: true,
      code: true,
    },
  },
  teacher: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      employeeNumber: true,
    },
  },
} satisfies Prisma.TimetableEntrySelect;

type TimetableSummaryRecord = Prisma.TimetableEntryGetPayload<{
  select: typeof timetableSummarySelect;
}>;

@Injectable()
export class TimetableService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string, query: ListTimetableQuery): Promise<PaginatedTimetable> {
    this.assertTenantContext(tenantId);

    const page = Math.max(1, Math.trunc(query.page ?? 1));
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, Math.trunc(query.pageSize ?? DEFAULT_PAGE_SIZE)),
    );

    const where = this.buildListWhere(tenantId, query);
    const orderBy: Prisma.TimetableEntryOrderByWithRelationInput = {
      [query.sortBy ?? 'dayOfWeek']: query.sortOrder ?? 'asc',
    };

    const [records, total] = await this.prisma.$transaction([
      this.prisma.timetableEntry.findMany({
        where,
        select: timetableSummarySelect,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.timetableEntry.count({ where }),
    ]);

    return {
      data: records.map((record) => this.toTimetableSummary(record)),
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  }

  async getById(tenantId: string, timetableId: string): Promise<TimetableSummary> {
    this.assertTenantContext(tenantId);

    const entry = await this.prisma.timetableEntry.findFirst({
      where: { id: timetableId, tenantId },
      select: timetableSummarySelect,
    });

    if (!entry) {
      throw new NotFoundException('Timetable entry not found');
    }

    return this.toTimetableSummary(entry);
  }

  async getByTeacher(tenantId: string, teacherId: string): Promise<TimetableSummary[]> {
    this.assertTenantContext(tenantId);
    await this.assertStaffInTenant(tenantId, teacherId);

    const entries = await this.prisma.timetableEntry.findMany({
      where: { tenantId, teacherId },
      select: timetableSummarySelect,
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });

    return entries.map((record) => this.toTimetableSummary(record));
  }

  async getMyTimetable(actor: TimetableActorContext, tenantId: string): Promise<TimetableSummary[]> {
    this.assertTenantContext(tenantId);

    const staff = await this.prisma.staff.findFirst({
      where: { tenantId, userId: actor.id },
      select: { id: true },
    });

    if (!staff) {
      throw new NotFoundException('Staff profile not found for this user');
    }

    const entries = await this.prisma.timetableEntry.findMany({
      where: { tenantId, teacherId: staff.id },
      select: timetableSummarySelect,
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });

    return entries.map((record) => this.toTimetableSummary(record));
  }

  async getByClassroom(tenantId: string, classroomId: string): Promise<TimetableSummary[]> {
    this.assertTenantContext(tenantId);
    await this.assertClassroomInTenant(tenantId, classroomId);

    const entries = await this.prisma.timetableEntry.findMany({
      where: { tenantId, classroomId },
      select: timetableSummarySelect,
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });

    return entries.map((record) => this.toTimetableSummary(record));
  }

  async create(actor: TimetableActorContext, input: CreateTimetableInput): Promise<TimetableSummary> {
    this.assertTenantContext(actor.tenantId);
    await this.assertActiveTenant(actor.tenantId);
    this.assertCanManage(actor.role);

    await Promise.all([
      this.assertClassroomInTenant(actor.tenantId, input.classroomId),
      this.assertSubjectInTenant(actor.tenantId, input.subjectId),
      input.teacherId ? this.assertStaffInTenant(actor.tenantId, input.teacherId) : Promise.resolve(),
    ]);

    this.validateTimeRange(input.startTime, input.endTime);
    await this.assertNoConflict(actor.tenantId, {
      classroomId: input.classroomId,
      teacherId: input.teacherId ?? null,
      dayOfWeek: input.dayOfWeek,
      startTime: input.startTime,
      endTime: input.endTime,
    });

    try {
      const entry = await this.prisma.timetableEntry.create({
        data: {
          tenantId: actor.tenantId,
          classroomId: input.classroomId,
          subjectId: input.subjectId,
          teacherId: input.teacherId ?? null,
          dayOfWeek: input.dayOfWeek,
          startTime: input.startTime,
          endTime: input.endTime,
          room: this.normalizeNullableString(input.room),
        },
        select: timetableSummarySelect,
      });

      return this.toTimetableSummary(entry);
    } catch (error) {
      this.rethrowTimetableWriteError(error);
    }
  }

  async update(
    actor: TimetableActorContext,
    timetableId: string,
    input: UpdateTimetableInput,
  ): Promise<TimetableSummary> {
    this.assertTenantContext(actor.tenantId);
    await this.assertActiveTenant(actor.tenantId);
    this.assertCanManage(actor.role);

    const existing = await this.prisma.timetableEntry.findFirst({
      where: { id: timetableId, tenantId: actor.tenantId },
      select: { id: true, classroomId: true, teacherId: true, dayOfWeek: true, startTime: true, endTime: true },
    });

    if (!existing) {
      throw new NotFoundException('Timetable entry not found');
    }

    const data: Prisma.TimetableEntryUncheckedUpdateInput = {};

    if (input.classroomId !== undefined) {
      await this.assertClassroomInTenant(actor.tenantId, input.classroomId);
      data.classroomId = input.classroomId;
    }

    if (input.subjectId !== undefined) {
      await this.assertSubjectInTenant(actor.tenantId, input.subjectId);
      data.subjectId = input.subjectId;
    }

    if (input.teacherId !== undefined) {
      if (input.teacherId) {
        await this.assertStaffInTenant(actor.tenantId, input.teacherId);
      }
      data.teacherId = input.teacherId;
    }

    if (input.dayOfWeek !== undefined) {
      data.dayOfWeek = input.dayOfWeek;
    }

    if (input.startTime !== undefined) {
      data.startTime = input.startTime;
    }

    if (input.endTime !== undefined) {
      data.endTime = input.endTime;
    }

    if (input.room !== undefined) {
      data.room = this.normalizeNullableString(input.room);
    }

    if (input.startTime !== undefined || input.endTime !== undefined || input.dayOfWeek !== undefined || input.classroomId !== undefined || input.teacherId !== undefined) {
      this.validateTimeRange(input.startTime ?? existing.startTime, input.endTime ?? existing.endTime);
      await this.assertNoConflict(actor.tenantId, {
        classroomId: input.classroomId ?? existing.classroomId,
        teacherId: input.teacherId !== undefined ? input.teacherId : existing.teacherId,
        dayOfWeek: input.dayOfWeek ?? existing.dayOfWeek,
        startTime: input.startTime ?? existing.startTime,
        endTime: input.endTime ?? existing.endTime,
        excludeId: timetableId,
      });
    }

    try {
      const entry = await this.prisma.timetableEntry.update({
        where: { id: timetableId, tenantId: actor.tenantId },
        data,
        select: timetableSummarySelect,
      });

      return this.toTimetableSummary(entry);
    } catch (error) {
      this.rethrowTimetableWriteError(error);
    }
  }

  async delete(actor: TimetableActorContext, timetableId: string): Promise<void> {
    this.assertTenantContext(actor.tenantId);
    await this.assertActiveTenant(actor.tenantId);
    this.assertCanAdmin(actor.role);

    const existing = await this.prisma.timetableEntry.findFirst({
      where: { id: timetableId, tenantId: actor.tenantId },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException('Timetable entry not found');
    }

    try {
      await this.prisma.timetableEntry.delete({
        where: { id: timetableId, tenantId: actor.tenantId },
      });
    } catch (error) {
      this.rethrowTimetableWriteError(error);
    }
  }

  private buildListWhere(tenantId: string, query: ListTimetableQuery): Prisma.TimetableEntryWhereInput {
    const where: Prisma.TimetableEntryWhereInput = { tenantId };

    if (query.classroomId) {
      where.classroomId = query.classroomId;
    }

    if (query.subjectId) {
      where.subjectId = query.subjectId;
    }

    if (query.teacherId) {
      where.teacherId = query.teacherId;
    }

    if (query.dayOfWeek) {
      where.dayOfWeek = query.dayOfWeek;
    }

    return where;
  }

  private async assertNoConflict(
    tenantId: string,
    input: {
      classroomId: string;
      teacherId: string | null;
      dayOfWeek: DayOfWeek;
      startTime: string;
      endTime: string;
      excludeId?: string;
    },
  ): Promise<void> {
    const startMinutes = this.timeToMinutes(input.startTime);
    const endMinutes = this.timeToMinutes(input.endTime);

    if (endMinutes <= startMinutes) {
      throw new BadRequestException('endTime must be after startTime');
    }

    const [classroomConflicts, teacherConflicts] = await Promise.all([
      this.prisma.timetableEntry.findMany({
        where: {
          tenantId,
          classroomId: input.classroomId,
          dayOfWeek: input.dayOfWeek,
          ...(input.excludeId ? { NOT: { id: input.excludeId } } : {}),
        },
        select: { id: true, startTime: true, endTime: true },
      }),
      input.teacherId
        ? this.prisma.timetableEntry.findMany({
            where: {
              tenantId,
              teacherId: input.teacherId,
              dayOfWeek: input.dayOfWeek,
              ...(input.excludeId ? { NOT: { id: input.excludeId } } : {}),
            },
            select: { id: true, startTime: true, endTime: true },
          })
        : [],
    ]);

    for (const conflict of classroomConflicts) {
      const cStart = this.timeToMinutes(conflict.startTime);
      const cEnd = this.timeToMinutes(conflict.endTime);
      if (startMinutes < cEnd && endMinutes > cStart) {
        throw new ConflictException('Classroom has a timetable conflict on this day and time');
      }
    }

    for (const conflict of teacherConflicts) {
      const cStart = this.timeToMinutes(conflict.startTime);
      const cEnd = this.timeToMinutes(conflict.endTime);
      if (startMinutes < cEnd && endMinutes > cStart) {
        throw new ConflictException('Teacher has a timetable conflict on this day and time');
      }
    }
  }

  private timeToMinutes(time: string): number {
    const [h, m] = time.split(':').map((v) => parseInt(v, 10));
    return h * 60 + m;
  }

  private validateTimeRange(startTime: string, endTime: string): void {
    const start = this.timeToMinutes(startTime);
    const end = this.timeToMinutes(endTime);
    if (end <= start) {
      throw new BadRequestException('endTime must be after startTime');
    }
  }

  private async assertClassroomInTenant(tenantId: string, classroomId: string): Promise<void> {
    const classroom = await this.prisma.classroom.findFirst({
      where: { id: classroomId, tenantId },
      select: { id: true },
    });

    if (!classroom) {
      throw new NotFoundException('Classroom not found');
    }
  }

  private async assertSubjectInTenant(tenantId: string, subjectId: string): Promise<void> {
    const subject = await this.prisma.subject.findFirst({
      where: { id: subjectId, tenantId },
      select: { id: true },
    });

    if (!subject) {
      throw new NotFoundException('Subject not found');
    }
  }

  private async assertStaffInTenant(tenantId: string, staffId: string): Promise<void> {
    const staff = await this.prisma.staff.findFirst({
      where: { id: staffId, tenantId },
      select: { id: true },
    });

    if (!staff) {
      throw new NotFoundException('Staff member not found');
    }
  }

  private assertCanManage(role: string): void {
    if (
      role === 'SUPER_ADMIN' ||
      role === 'ADMIN' ||
      role === 'PRINCIPAL' ||
      role === 'VICE_PRINCIPAL'
    ) {
      return;
    }
    throw new ForbiddenException('Only administrators can manage timetable');
  }

  private assertCanAdmin(role: string): void {
    if (role === 'SUPER_ADMIN' || role === 'ADMIN') {
      return;
    }
    throw new ForbiddenException('Only super admins and admins can delete timetable entries');
  }

  private async assertActiveTenant(tenantId: string): Promise<void> {
    const tenant = await this.prisma.school.findUnique({
      where: { id: tenantId },
      select: { isActive: true },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    if (!tenant.isActive) {
      throw new ForbiddenException('Tenant is inactive');
    }
  }

  private assertTenantContext(tenantId: string): void {
    if (!tenantId || !tenantId.trim()) {
      throw new UnauthorizedException('Tenant context missing');
    }
  }

  private normalizeNullableString(value?: string | null): string | null {
    if (value === undefined || value === null) {
      return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private rethrowTimetableWriteError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        throw new ConflictException('Timetable entry conflict');
      }
      if (error.code === 'P2025') {
        throw new NotFoundException('Timetable entry or related entity not found');
      }
      if (error.code === 'P2003') {
        throw new ConflictException('Related record does not exist');
      }
    }

    throw error;
  }

  private toTimetableSummary(record: TimetableSummaryRecord): TimetableSummary {
    return {
      id: record.id,
      tenantId: record.tenantId,
      classroomId: record.classroomId,
      subjectId: record.subjectId,
      teacherId: record.teacherId,
      dayOfWeek: record.dayOfWeek,
      startTime: record.startTime,
      endTime: record.endTime,
      room: record.room,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
      classroom: {
        id: record.classroom.id,
        name: record.classroom.name,
        code: record.classroom.code,
        gradeLevel: record.classroom.gradeLevel,
      },
      subject: {
        id: record.subject.id,
        name: record.subject.name,
        code: record.subject.code,
      },
      teacher: record.teacher
        ? {
            id: record.teacher.id,
            firstName: record.teacher.firstName,
            lastName: record.teacher.lastName,
            employeeNumber: record.teacher.employeeNumber,
          }
        : null,
    };
  }
}
