import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { AttendanceStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  BulkStaffAttendanceInput,
  CreateStaffAttendanceInput,
  ListStaffAttendanceQuery,
  PaginatedStaffAttendance,
  StaffAttendanceActorContext,
  StaffAttendanceSummary,
  UpdateStaffAttendanceInput,
} from './staffattendance.types.js';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

const staffAttendanceSummarySelect = {
  id: true,
  tenantId: true,
  staffId: true,
  date: true,
  status: true,
  checkIn: true,
  checkOut: true,
  remarks: true,
  createdAt: true,
  updatedAt: true,
  staff: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      employeeNumber: true,
      jobTitle: true,
      departmentId: true,
    },
  },
} satisfies Prisma.StaffAttendanceSelect;

type StaffAttendanceSummaryRecord = Prisma.StaffAttendanceGetPayload<{
  select: typeof staffAttendanceSummarySelect;
}>;

@Injectable()
export class StaffAttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    tenantId: string,
    query: ListStaffAttendanceQuery,
  ): Promise<PaginatedStaffAttendance> {
    this.assertTenantContext(tenantId);

    const page = Math.max(1, Math.trunc(query.page ?? 1));
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, Math.trunc(query.pageSize ?? DEFAULT_PAGE_SIZE)),
    );

    const where = this.buildListWhere(tenantId, query);
    const orderBy: Prisma.StaffAttendanceOrderByWithRelationInput = {
      [query.sortBy ?? 'date']: query.sortOrder ?? 'desc',
    };

    const [records, total] = await this.prisma.$transaction([
      this.prisma.staffAttendance.findMany({
        where,
        select: staffAttendanceSummarySelect,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.staffAttendance.count({ where }),
    ]);

    return {
      data: records.map((record) => this.toStaffAttendanceSummary(record)),
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  }

  async getById(
    tenantId: string,
    attendanceId: string,
  ): Promise<StaffAttendanceSummary> {
    this.assertTenantContext(tenantId);

    const attendance = await this.prisma.staffAttendance.findFirst({
      where: { id: attendanceId, tenantId },
      select: staffAttendanceSummarySelect,
    });

    if (!attendance) {
      throw new NotFoundException('Staff attendance record not found');
    }

    return this.toStaffAttendanceSummary(attendance);
  }

  async create(
    actor: StaffAttendanceActorContext,
    input: CreateStaffAttendanceInput,
  ): Promise<StaffAttendanceSummary> {
    this.assertTenantContext(actor.tenantId);
    await this.assertActiveTenant(actor.tenantId);
    this.assertCanManage(actor.role);

    await this.assertStaffInTenant(actor.tenantId, input.staffId);
    const date = this.toDate(input.date);

    try {
      const record = await this.prisma.staffAttendance.create({
        data: {
          tenantId: actor.tenantId,
          staffId: input.staffId,
          date,
          status: input.status ?? AttendanceStatus.PRESENT,
          checkIn: this.normalizeNullableString(input.checkIn),
          checkOut: this.normalizeNullableString(input.checkOut),
          remarks: this.normalizeNullableString(input.remarks),
        },
        select: staffAttendanceSummarySelect,
      });

      return this.toStaffAttendanceSummary(record);
    } catch (error) {
      this.rethrowWriteError(error);
    }
  }

  async bulkUpsert(
    actor: StaffAttendanceActorContext,
    input: BulkStaffAttendanceInput,
  ): Promise<StaffAttendanceSummary[]> {
    this.assertTenantContext(actor.tenantId);
    await this.assertActiveTenant(actor.tenantId);
    this.assertCanManage(actor.role);

    if (input.records.length === 0) {
      throw new BadRequestException('At least one attendance record is required');
    }

    const date = this.toDate(input.date);
    const staffIds = input.records.map((record) => record.staffId);
    const uniqueStaffIds = new Set(staffIds);

    if (uniqueStaffIds.size !== staffIds.length) {
      throw new BadRequestException(
        'Each staff member can only appear once in a bulk attendance submission',
      );
    }

    await this.assertStaffInTenant(actor.tenantId, staffIds);

    try {
      const records = await this.prisma.$transaction(
        input.records.map((record) =>
          this.prisma.staffAttendance.upsert({
            where: {
              tenantId_staffId_date: {
                tenantId: actor.tenantId,
                staffId: record.staffId,
                date,
              },
            },
            create: {
              tenantId: actor.tenantId,
              staffId: record.staffId,
              date,
              status: record.status,
              checkIn: this.normalizeNullableString(record.checkIn),
              checkOut: this.normalizeNullableString(record.checkOut),
              remarks: this.normalizeNullableString(record.remarks),
            },
            update: {
              status: record.status,
              checkIn: this.normalizeNullableString(record.checkIn),
              checkOut: this.normalizeNullableString(record.checkOut),
              remarks: this.normalizeNullableString(record.remarks),
            },
            select: staffAttendanceSummarySelect,
          }),
        ),
      );

      return records.map((record) => this.toStaffAttendanceSummary(record));
    } catch (error) {
      this.rethrowWriteError(error);
    }
  }

  async update(
    actor: StaffAttendanceActorContext,
    attendanceId: string,
    input: UpdateStaffAttendanceInput,
  ): Promise<StaffAttendanceSummary> {
    this.assertTenantContext(actor.tenantId);
    await this.assertActiveTenant(actor.tenantId);
    this.assertCanManage(actor.role);

    const existing = await this.prisma.staffAttendance.findFirst({
      where: { id: attendanceId, tenantId: actor.tenantId },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException('Staff attendance record not found');
    }

    const data: Prisma.StaffAttendanceUpdateInput = {};

    if (input.status !== undefined) {
      data.status = input.status;
    }

    if (input.checkIn !== undefined) {
      data.checkIn = this.normalizeNullableString(input.checkIn);
    }

    if (input.checkOut !== undefined) {
      data.checkOut = this.normalizeNullableString(input.checkOut);
    }

    if (input.remarks !== undefined) {
      data.remarks = this.normalizeNullableString(input.remarks);
    }

    try {
      const record = await this.prisma.staffAttendance.update({
        where: { id: attendanceId },
        data,
        select: staffAttendanceSummarySelect,
      });

      return this.toStaffAttendanceSummary(record);
    } catch (error) {
      this.rethrowWriteError(error);
    }
  }

  async delete(
    actor: StaffAttendanceActorContext,
    attendanceId: string,
  ): Promise<void> {
    this.assertTenantContext(actor.tenantId);
    await this.assertActiveTenant(actor.tenantId);
    this.assertCanAdmin(actor.role);

    const existing = await this.prisma.staffAttendance.findFirst({
      where: { id: attendanceId, tenantId: actor.tenantId },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException('Staff attendance record not found');
    }

    await this.prisma.staffAttendance.delete({ where: { id: attendanceId } });
  }

  private buildListWhere(
    tenantId: string,
    query: ListStaffAttendanceQuery,
  ): Prisma.StaffAttendanceWhereInput {
    const where: Prisma.StaffAttendanceWhereInput = { tenantId };

    if (query.staffId) {
      where.staffId = query.staffId;
    }

    if (query.departmentId) {
      where.staff = { departmentId: query.departmentId };
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.dateFrom || query.dateTo) {
      where.date = {
        ...(query.dateFrom ? { gte: this.toDate(query.dateFrom) } : {}),
        ...(query.dateTo ? { lte: this.toDate(query.dateTo) } : {}),
      };
    }

    return where;
  }

  private async assertStaffInTenant(
    tenantId: string,
    staffId: string | string[],
  ): Promise<void> {
    const staffIds = Array.isArray(staffId) ? staffId : [staffId];
    const uniqueIds = [...new Set(staffIds)];

    const staff = await this.prisma.staff.findMany({
      where: { tenantId, id: { in: uniqueIds } },
      select: { id: true },
    });

    if (staff.length !== uniqueIds.length) {
      throw new NotFoundException('One or more staff members were not found');
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

    throw new ForbiddenException(
      'Only administrators can manage staff attendance',
    );
  }

  private assertCanAdmin(role: string): void {
    if (role === 'SUPER_ADMIN' || role === 'ADMIN') {
      return;
    }

    throw new ForbiddenException(
      'Only super admins and admins can delete staff attendance records',
    );
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

  private toDate(value: string): Date {
    const date = new Date(value);

    if (isNaN(date.getTime())) {
      throw new BadRequestException('Invalid date format');
    }

    return date;
  }

  private toDateOnly(value: Date): string {
    return value.toISOString().slice(0, 10);
  }

  private normalizeNullableString(value?: string | null): string | null {
    if (value === undefined || value === null) {
      return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private rethrowWriteError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        throw new ConflictException(
          'Attendance has already been recorded for this staff member on this date',
        );
      }

      if (error.code === 'P2025') {
        throw new NotFoundException(
          'Staff attendance record or related entity not found',
        );
      }

      if (error.code === 'P2003') {
        throw new ConflictException('Related record does not exist');
      }
    }

    throw error;
  }

  private toStaffAttendanceSummary(
    record: StaffAttendanceSummaryRecord,
  ): StaffAttendanceSummary {
    return {
      id: record.id,
      tenantId: record.tenantId,
      staffId: record.staffId,
      date: this.toDateOnly(record.date),
      status: record.status,
      checkIn: record.checkIn,
      checkOut: record.checkOut,
      remarks: record.remarks,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
      staff: {
        id: record.staff.id,
        firstName: record.staff.firstName,
        lastName: record.staff.lastName,
        employeeNumber: record.staff.employeeNumber,
        jobTitle: record.staff.jobTitle,
        departmentId: record.staff.departmentId,
      },
    };
  }
}
