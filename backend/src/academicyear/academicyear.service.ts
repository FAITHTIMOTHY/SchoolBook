import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { AcademicYearStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  AcademicYearActorContext,
  AcademicYearSummary,
  CreateAcademicYearInput,
  ListAcademicYearsQuery,
  PaginatedAcademicYears,
  UpdateAcademicYearInput,
} from './academicyear.types.js';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

const academicYearSummarySelect = {
  id: true,
  tenantId: true,
  name: true,
  startDate: true,
  endDate: true,
  status: true,
  isCurrent: true,
  createdAt: true,
  updatedAt: true,
  _count: {
    select: {
      terms: true,
      classrooms: true,
      enrollments: true,
    },
  },
} satisfies Prisma.AcademicYearSelect;

type AcademicYearSummaryRecord = Prisma.AcademicYearGetPayload<{
  select: typeof academicYearSummarySelect;
}>;

@Injectable()
export class AcademicYearService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string, query: ListAcademicYearsQuery): Promise<PaginatedAcademicYears> {
    this.assertTenantContext(tenantId);

    const page = Math.max(1, Math.trunc(query.page ?? 1));
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, Math.trunc(query.pageSize ?? DEFAULT_PAGE_SIZE)),
    );

    const where = this.buildListWhere(tenantId, query);
    const orderBy: Prisma.AcademicYearOrderByWithRelationInput = {
      [query.sortBy ?? 'startDate']: query.sortOrder ?? 'desc',
    };

    const [records, total] = await this.prisma.$transaction([
      this.prisma.academicYear.findMany({
        where,
        select: academicYearSummarySelect,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.academicYear.count({ where }),
    ]);

    return {
      data: records.map((record) => this.toAcademicYearSummary(record)),
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  }

  async getById(tenantId: string, academicYearId: string): Promise<AcademicYearSummary> {
    this.assertTenantContext(tenantId);

    const academicYear = await this.prisma.academicYear.findFirst({
      where: { id: academicYearId, tenantId },
      select: academicYearSummarySelect,
    });

    if (!academicYear) {
      throw new NotFoundException('Academic year not found');
    }

    return this.toAcademicYearSummary(academicYear);
  }

  async create(
    actor: AcademicYearActorContext,
    input: CreateAcademicYearInput,
  ): Promise<AcademicYearSummary> {
    this.assertTenantContext(actor.tenantId);
    await this.assertActiveTenant(actor.tenantId);
    this.assertCanManage(actor.role);

    const name = input.name.trim();
    await this.assertNameAvailable(actor.tenantId, name);

    this.assertDateRange(input.startDate, input.endDate);

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        if (input.isCurrent) {
          await tx.academicYear.updateMany({
            where: { tenantId: actor.tenantId, isCurrent: true },
            data: { isCurrent: false },
          });
        }

        const academicYear = await tx.academicYear.create({
          data: {
            tenantId: actor.tenantId,
            name,
            startDate: this.toDate(input.startDate),
            endDate: this.toDate(input.endDate),
            status: input.status ?? AcademicYearStatus.UPCOMING,
            isCurrent: input.isCurrent ?? false,
          },
          select: academicYearSummarySelect,
        });

        return academicYear;
      });

      return this.toAcademicYearSummary(result);
    } catch (error) {
      this.rethrowAcademicYearWriteError(error);
    }
  }

  async update(
    actor: AcademicYearActorContext,
    academicYearId: string,
    input: UpdateAcademicYearInput,
  ): Promise<AcademicYearSummary> {
    this.assertTenantContext(actor.tenantId);
    await this.assertActiveTenant(actor.tenantId);
    this.assertCanManage(actor.role);

    const existing = await this.prisma.academicYear.findFirst({
      where: { id: academicYearId, tenantId: actor.tenantId },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException('Academic year not found');
    }

    const data: Prisma.AcademicYearUncheckedUpdateInput = {};

    if (input.name !== undefined) {
      const name = input.name.trim();
      await this.assertNameAvailable(actor.tenantId, name, academicYearId);
      data.name = name;
    }

    if (input.startDate !== undefined || input.endDate !== undefined) {
      const start = input.startDate ?? '';
      const end = input.endDate ?? '';
      if (start && end) {
        this.assertDateRange(start, end);
      }
      if (input.startDate) {
        data.startDate = this.toDate(input.startDate);
      }
      if (input.endDate) {
        data.endDate = this.toDate(input.endDate);
      }
    }

    if (input.status !== undefined) {
      data.status = input.status;
    }

    if (input.isCurrent !== undefined) {
      data.isCurrent = input.isCurrent;
    }

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        if (input.isCurrent) {
          await tx.academicYear.updateMany({
            where: {
              tenantId: actor.tenantId,
              isCurrent: true,
              id: { not: academicYearId },
            },
            data: { isCurrent: false },
          });
        }

        const academicYear = await tx.academicYear.update({
          where: { id: academicYearId, tenantId: actor.tenantId },
          data,
          select: academicYearSummarySelect,
        });

        return academicYear;
      });

      return this.toAcademicYearSummary(result);
    } catch (error) {
      this.rethrowAcademicYearWriteError(error);
    }
  }

  async setCurrent(
    actor: AcademicYearActorContext,
    academicYearId: string,
    isCurrent: boolean,
  ): Promise<AcademicYearSummary> {
    this.assertTenantContext(actor.tenantId);
    await this.assertActiveTenant(actor.tenantId);
    this.assertCanManage(actor.role);

    const existing = await this.prisma.academicYear.findFirst({
      where: { id: academicYearId, tenantId: actor.tenantId },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException('Academic year not found');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      if (isCurrent) {
        await tx.academicYear.updateMany({
          where: { tenantId: actor.tenantId, isCurrent: true },
          data: { isCurrent: false },
        });
      }

      return tx.academicYear.update({
        where: { id: academicYearId, tenantId: actor.tenantId },
        data: { isCurrent },
        select: academicYearSummarySelect,
      });
    });

    return this.toAcademicYearSummary(result);
  }

  async delete(actor: AcademicYearActorContext, academicYearId: string): Promise<void> {
    this.assertTenantContext(actor.tenantId);
    await this.assertActiveTenant(actor.tenantId);
    this.assertCanAdmin(actor.role);

    const existing = await this.prisma.academicYear.findFirst({
      where: { id: academicYearId, tenantId: actor.tenantId },
      select: { id: true, _count: { select: { terms: true, classrooms: true, enrollments: true } } },
    });

    if (!existing) {
      throw new NotFoundException('Academic year not found');
    }

    if (existing._count.terms > 0 || existing._count.classrooms > 0 || existing._count.enrollments > 0) {
      throw new ConflictException('Cannot delete academic year with related terms, classrooms, or enrollments');
    }

    try {
      await this.prisma.academicYear.delete({
        where: { id: academicYearId, tenantId: actor.tenantId },
      });
    } catch (error) {
      this.rethrowAcademicYearWriteError(error);
    }
  }

  private buildListWhere(tenantId: string, query: ListAcademicYearsQuery): Prisma.AcademicYearWhereInput {
    const where: Prisma.AcademicYearWhereInput = { tenantId };

    if (query.status) {
      where.status = query.status;
    }

    if (typeof query.isCurrent === 'boolean') {
      where.isCurrent = query.isCurrent;
    }

    if (query.search) {
      const search = query.search.trim();

      if (search) {
        where.name = { contains: search, mode: 'insensitive' };
      }
    }

    return where;
  }

  private async assertNameAvailable(
    tenantId: string,
    name: string,
    excludeAcademicYearId?: string,
  ): Promise<void> {
    const existing = await this.prisma.academicYear.findFirst({
      where: {
        tenantId,
        name,
        ...(excludeAcademicYearId ? { NOT: { id: excludeAcademicYearId } } : {}),
      },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException('An academic year with this name already exists');
    }
  }

  private assertDateRange(startDate: string, endDate: string): void {
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException('Invalid date format');
    }

    if (end < start) {
      throw new BadRequestException('endDate must be after or equal to startDate');
    }
  }

  private assertCanManage(role: string): void {
    if (role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'PRINCIPAL') {
      return;
    }
    throw new ForbiddenException('Only administrators can manage academic years');
  }

  private assertCanAdmin(role: string): void {
    if (role === 'SUPER_ADMIN' || role === 'ADMIN') {
      return;
    }
    throw new ForbiddenException('Only super admins and admins can delete academic years');
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
    return new Date(value);
  }

  private toDateOnly(value: Date): string {
    return value.toISOString().slice(0, 10);
  }

  private rethrowAcademicYearWriteError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        throw new ConflictException('An academic year with this name already exists');
      }

      if (error.code === 'P2025') {
        throw new NotFoundException('Academic year or related entity not found');
      }

      if (error.code === 'P2003') {
        throw new ConflictException('Related record does not exist');
      }
    }

    throw error;
  }

  private toAcademicYearSummary(record: AcademicYearSummaryRecord): AcademicYearSummary {
    return {
      id: record.id,
      tenantId: record.tenantId,
      name: record.name,
      startDate: this.toDateOnly(record.startDate),
      endDate: this.toDateOnly(record.endDate),
      status: record.status,
      isCurrent: record.isCurrent,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
      _count: {
        terms: record._count.terms,
        classrooms: record._count.classrooms,
        enrollments: record._count.enrollments,
      },
    };
  }
}
