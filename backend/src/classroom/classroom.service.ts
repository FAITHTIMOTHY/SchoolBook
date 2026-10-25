import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  ClassroomActorContext,
  ClassroomSummary,
  CreateClassroomInput,
  ListClassroomsQuery,
  PaginatedClassrooms,
  UpdateClassroomInput,
} from './classroom.types.js';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

const classroomSummarySelect = {
  id: true,
  tenantId: true,
  name: true,
  code: true,
  gradeLevel: true,
  section: true,
  capacity: true,
  room: true,
  academicYearId: true,
  classTeacherId: true,
  createdAt: true,
  updatedAt: true,
  academicYear: {
    select: {
      id: true,
      name: true,
      status: true,
    },
  },
  classTeacher: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      employeeNumber: true,
    },
  },
  _count: {
    select: {
      enrollments: true,
      classSubjects: true,
      timetableEntries: true,
    },
  },
} satisfies Prisma.ClassroomSelect;

type ClassroomSummaryRecord = Prisma.ClassroomGetPayload<{
  select: typeof classroomSummarySelect;
}>;

@Injectable()
export class ClassroomService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string, query: ListClassroomsQuery): Promise<PaginatedClassrooms> {
    this.assertTenantContext(tenantId);

    const page = Math.max(1, Math.trunc(query.page ?? 1));
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, Math.trunc(query.pageSize ?? DEFAULT_PAGE_SIZE)),
    );

    const where = this.buildListWhere(tenantId, query);
    const orderBy: Prisma.ClassroomOrderByWithRelationInput = {
      [query.sortBy ?? 'name']: query.sortOrder ?? 'asc',
    };

    const [records, total] = await this.prisma.$transaction([
      this.prisma.classroom.findMany({
        where,
        select: classroomSummarySelect,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.classroom.count({ where }),
    ]);

    return {
      data: records.map((record) => this.toClassroomSummary(record)),
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  }

  async getById(tenantId: string, classroomId: string): Promise<ClassroomSummary> {
    this.assertTenantContext(tenantId);

    const classroom = await this.prisma.classroom.findFirst({
      where: { id: classroomId, tenantId },
      select: classroomSummarySelect,
    });

    if (!classroom) {
      throw new NotFoundException('Classroom not found');
    }

    return this.toClassroomSummary(classroom);
  }

  async create(actor: ClassroomActorContext, input: CreateClassroomInput): Promise<ClassroomSummary> {
    this.assertTenantContext(actor.tenantId);
    await this.assertActiveTenant(actor.tenantId);
    this.assertCanManage(actor.role);

    await Promise.all([
      this.assertAcademicYearInTenant(actor.tenantId, input.academicYearId),
      input.classTeacherId
        ? this.assertStaffInTenant(actor.tenantId, input.classTeacherId)
        : Promise.resolve(),
    ]);

    const name = input.name.trim();
    await this.assertClassroomNameUnique(actor.tenantId, input.academicYearId, name);

    try {
      const classroom = await this.prisma.classroom.create({
        data: {
          tenantId: actor.tenantId,
          name,
          code: this.normalizeNullableString(input.code),
          gradeLevel: input.gradeLevel ?? null,
          section: this.normalizeNullableString(input.section),
          capacity: input.capacity ?? null,
          room: this.normalizeNullableString(input.room),
          academicYearId: input.academicYearId,
          classTeacherId: input.classTeacherId ?? null,
        },
        select: classroomSummarySelect,
      });

      return this.toClassroomSummary(classroom);
    } catch (error) {
      this.rethrowClassroomWriteError(error);
    }
  }

  async update(
    actor: ClassroomActorContext,
    classroomId: string,
    input: UpdateClassroomInput,
  ): Promise<ClassroomSummary> {
    this.assertTenantContext(actor.tenantId);
    await this.assertActiveTenant(actor.tenantId);
    this.assertCanManage(actor.role);

    const existing = await this.prisma.classroom.findFirst({
      where: { id: classroomId, tenantId: actor.tenantId },
      select: { id: true, academicYearId: true },
    });

    if (!existing) {
      throw new NotFoundException('Classroom not found');
    }

    const data: Prisma.ClassroomUncheckedUpdateInput = {};

    if (input.name !== undefined) {
      const name = input.name.trim();
      await this.assertClassroomNameUnique(
        actor.tenantId,
        input.academicYearId ?? existing.academicYearId,
        name,
        classroomId,
      );
      data.name = name;
    }

    if (input.academicYearId !== undefined) {
      await this.assertAcademicYearInTenant(actor.tenantId, input.academicYearId);
      data.academicYearId = input.academicYearId;
    }

    if (input.classTeacherId !== undefined) {
      if (input.classTeacherId) {
        await this.assertStaffInTenant(actor.tenantId, input.classTeacherId);
      }
      data.classTeacherId = input.classTeacherId;
    }

    if (input.code !== undefined) {
      data.code = this.normalizeNullableString(input.code);
    }

    if (input.gradeLevel !== undefined) {
      data.gradeLevel = input.gradeLevel;
    }

    if (input.section !== undefined) {
      data.section = this.normalizeNullableString(input.section);
    }

    if (input.capacity !== undefined) {
      data.capacity = input.capacity;
    }

    if (input.room !== undefined) {
      data.room = this.normalizeNullableString(input.room);
    }

    try {
      const classroom = await this.prisma.classroom.update({
        where: { id: classroomId, tenantId: actor.tenantId },
        data,
        select: classroomSummarySelect,
      });

      return this.toClassroomSummary(classroom);
    } catch (error) {
      this.rethrowClassroomWriteError(error);
    }
  }

  async assignClassTeacher(
    actor: ClassroomActorContext,
    classroomId: string,
    classTeacherId: string | null,
  ): Promise<ClassroomSummary> {
    this.assertTenantContext(actor.tenantId);
    await this.assertActiveTenant(actor.tenantId);
    this.assertCanManage(actor.role);

    const existing = await this.prisma.classroom.findFirst({
      where: { id: classroomId, tenantId: actor.tenantId },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException('Classroom not found');
    }

    if (classTeacherId) {
      await this.assertStaffInTenant(actor.tenantId, classTeacherId);
    }

    const classroom = await this.prisma.classroom.update({
      where: { id: classroomId, tenantId: actor.tenantId },
      data: { classTeacherId },
      select: classroomSummarySelect,
    });

    return this.toClassroomSummary(classroom);
  }

  async delete(actor: ClassroomActorContext, classroomId: string): Promise<void> {
    this.assertTenantContext(actor.tenantId);
    await this.assertActiveTenant(actor.tenantId);
    this.assertCanAdmin(actor.role);

    const existing = await this.prisma.classroom.findFirst({
      where: { id: classroomId, tenantId: actor.tenantId },
      select: { id: true, _count: { select: { enrollments: true } } },
    });

    if (!existing) {
      throw new NotFoundException('Classroom not found');
    }

    if (existing._count.enrollments > 0) {
      throw new ConflictException('Cannot delete classroom with active enrollments');
    }

    try {
      await this.prisma.classroom.delete({
        where: { id: classroomId, tenantId: actor.tenantId },
      });
    } catch (error) {
      this.rethrowClassroomWriteError(error);
    }
  }

  private buildListWhere(tenantId: string, query: ListClassroomsQuery): Prisma.ClassroomWhereInput {
    const where: Prisma.ClassroomWhereInput = { tenantId };

    if (query.academicYearId) {
      where.academicYearId = query.academicYearId;
    }

    if (query.classTeacherId) {
      where.classTeacherId = query.classTeacherId;
    }

    if (typeof query.gradeLevel === 'number') {
      where.gradeLevel = query.gradeLevel;
    }

    if (query.search) {
      const search = query.search.trim();

      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { code: { contains: search, mode: 'insensitive' } },
          { room: { contains: search, mode: 'insensitive' } },
        ];
      }
    }

    return where;
  }

  private async assertClassroomNameUnique(
    tenantId: string,
    academicYearId: string,
    name: string,
    excludeClassroomId?: string,
  ): Promise<void> {
    const existing = await this.prisma.classroom.findFirst({
      where: {
        tenantId,
        academicYearId,
        name,
        ...(excludeClassroomId ? { NOT: { id: excludeClassroomId } } : {}),
      },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException('A classroom with this name already exists in this academic year');
    }
  }

  private async assertAcademicYearInTenant(tenantId: string, academicYearId: string): Promise<void> {
    const academicYear = await this.prisma.academicYear.findFirst({
      where: { id: academicYearId, tenantId },
      select: { id: true },
    });

    if (!academicYear) {
      throw new NotFoundException('Academic year not found');
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
    if (role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'PRINCIPAL') {
      return;
    }
    throw new ForbiddenException('Only administrators can manage classrooms');
  }

  private assertCanAdmin(role: string): void {
    if (role === 'SUPER_ADMIN' || role === 'ADMIN') {
      return;
    }
    throw new ForbiddenException('Only super admins and admins can delete classrooms');
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

  private rethrowClassroomWriteError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        throw new ConflictException('A classroom with this configuration already exists');
      }

      if (error.code === 'P2025') {
        throw new NotFoundException('Classroom or related entity not found');
      }

      if (error.code === 'P2003') {
        throw new ConflictException('Related record does not exist');
      }
    }

    throw error;
  }

  private toClassroomSummary(record: ClassroomSummaryRecord): ClassroomSummary {
    return {
      id: record.id,
      tenantId: record.tenantId,
      name: record.name,
      code: record.code,
      gradeLevel: record.gradeLevel,
      section: record.section,
      capacity: record.capacity,
      room: record.room,
      academicYearId: record.academicYearId,
      classTeacherId: record.classTeacherId,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
      academicYear: {
        id: record.academicYear.id,
        name: record.academicYear.name,
        status: record.academicYear.status,
      },
      classTeacher: record.classTeacher
        ? {
            id: record.classTeacher.id,
            firstName: record.classTeacher.firstName,
            lastName: record.classTeacher.lastName,
            employeeNumber: record.classTeacher.employeeNumber,
          }
        : null,
      _count: {
        enrollments: record._count.enrollments,
        classSubjects: record._count.classSubjects,
        timetableEntries: record._count.timetableEntries,
      },
    };
  }
}
