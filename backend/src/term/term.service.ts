import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma, TermStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  CreateTermInput,
  ListTermsQuery,
  PaginatedTerms,
  TermActorContext,
  TermSummary,
  UpdateTermInput,
} from './term.types.js';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

const termSummarySelect = {
  id: true,
  tenantId: true,
  name: true,
  academicYearId: true,
  startDate: true,
  endDate: true,
  status: true,
  isCurrent: true,
  createdAt: true,
  updatedAt: true,
  academicYear: {
    select: {
      id: true,
      name: true,
    },
  },
} satisfies Prisma.TermSelect;

type TermSummaryRecord = Prisma.TermGetPayload<{
  select: typeof termSummarySelect;
}>;

@Injectable()
export class TermService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string, query: ListTermsQuery): Promise<PaginatedTerms> {
    this.assertTenantContext(tenantId);

    const page = Math.max(1, Math.trunc(query.page ?? 1));
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, Math.trunc(query.pageSize ?? DEFAULT_PAGE_SIZE)),
    );

    const where = this.buildListWhere(tenantId, query);
    const orderBy: Prisma.TermOrderByWithRelationInput = {
      [query.sortBy ?? 'startDate']: query.sortOrder ?? 'desc',
    };

    const [records, total] = await this.prisma.$transaction([
      this.prisma.term.findMany({
        where,
        select: termSummarySelect,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.term.count({ where }),
    ]);

    return {
      data: records.map((record) => this.toTermSummary(record)),
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  }

  async getById(tenantId: string, termId: string): Promise<TermSummary> {
    this.assertTenantContext(tenantId);

    const term = await this.prisma.term.findFirst({
      where: { id: termId, tenantId },
      select: termSummarySelect,
    });

    if (!term) {
      throw new NotFoundException('Term not found');
    }

    return this.toTermSummary(term);
  }

  async create(actor: TermActorContext, input: CreateTermInput): Promise<TermSummary> {
    this.assertTenantContext(actor.tenantId);
    await this.assertActiveTenant(actor.tenantId);
    this.assertCanManage(actor.role);

    const name = input.name.trim();
    await Promise.all([
      this.assertAcademicYearInTenant(actor.tenantId, input.academicYearId),
      this.assertNameAvailable(actor.tenantId, input.academicYearId, name),
    ]);

    this.assertDateRange(input.startDate, input.endDate);

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        if (input.isCurrent) {
          await tx.term.updateMany({
            where: { tenantId: actor.tenantId, isCurrent: true },
            data: { isCurrent: false },
          });
        }

        const term = await tx.term.create({
          data: {
            tenantId: actor.tenantId,
            name,
            academicYearId: input.academicYearId,
            startDate: this.toDate(input.startDate),
            endDate: this.toDate(input.endDate),
            status: input.status ?? TermStatus.UPCOMING,
            isCurrent: input.isCurrent ?? false,
          },
          select: termSummarySelect,
        });

        return term;
      });

      return this.toTermSummary(result);
    } catch (error) {
      this.rethrowTermWriteError(error);
    }
  }

  async update(actor: TermActorContext, termId: string, input: UpdateTermInput): Promise<TermSummary> {
    this.assertTenantContext(actor.tenantId);
    await this.assertActiveTenant(actor.tenantId);
    this.assertCanManage(actor.role);

    const existing = await this.prisma.term.findFirst({
      where: { id: termId, tenantId: actor.tenantId },
      select: { id: true, academicYearId: true },
    });

    if (!existing) {
      throw new NotFoundException('Term not found');
    }

    const data: Prisma.TermUncheckedUpdateInput = {};

    if (input.name !== undefined) {
      const name = input.name.trim();
      await this.assertNameAvailable(
        actor.tenantId,
        input.academicYearId ?? existing.academicYearId,
        name,
        termId,
      );
      data.name = name;
    }

    if (input.academicYearId !== undefined) {
      await this.assertAcademicYearInTenant(actor.tenantId, input.academicYearId);
      data.academicYearId = input.academicYearId;
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
          await tx.term.updateMany({
            where: { tenantId: actor.tenantId, isCurrent: true },
            data: { isCurrent: false },
          });
        }

        const term = await tx.term.update({
          where: { id: termId, tenantId: actor.tenantId },
          data,
          select: termSummarySelect,
        });

        return term;
      });

      return this.toTermSummary(result);
    } catch (error) {
      this.rethrowTermWriteError(error);
    }
  }

  async setCurrent(actor: TermActorContext, termId: string, isCurrent: boolean): Promise<TermSummary> {
    this.assertTenantContext(actor.tenantId);
    await this.assertActiveTenant(actor.tenantId);
    this.assertCanManage(actor.role);

    const existing = await this.prisma.term.findFirst({
      where: { id: termId, tenantId: actor.tenantId },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException('Term not found');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      if (isCurrent) {
        await tx.term.updateMany({
          where: { tenantId: actor.tenantId, isCurrent: true },
          data: { isCurrent: false },
        });
      }

      return tx.term.update({
        where: { id: termId, tenantId: actor.tenantId },
        data: { isCurrent },
        select: termSummarySelect,
      });
    });

    return this.toTermSummary(result);
  }

  async delete(actor: TermActorContext, termId: string): Promise<void> {
    this.assertTenantContext(actor.tenantId);
    await this.assertActiveTenant(actor.tenantId);
    this.assertCanAdmin(actor.role);

    const existing = await this.prisma.term.findFirst({
      where: { id: termId, tenantId: actor.tenantId },
      select: { id: true, _count: { select: { attendanceSessions: true, exams: true, invoices: true } } },
    });

    if (!existing) {
      throw new NotFoundException('Term not found');
    }

    if (existing._count.attendanceSessions > 0 || existing._count.exams > 0 || existing._count.invoices > 0) {
      throw new ConflictException('Cannot delete term with related attendance sessions, exams, or invoices');
    }

    try {
      await this.prisma.term.delete({
        where: { id: termId, tenantId: actor.tenantId },
      });
    } catch (error) {
      this.rethrowTermWriteError(error);
    }
  }

  private buildListWhere(tenantId: string, query: ListTermsQuery): Prisma.TermWhereInput {
    const where: Prisma.TermWhereInput = { tenantId };

    if (query.academicYearId) {
      where.academicYearId = query.academicYearId;
    }

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
    academicYearId: string,
    name: string,
    excludeTermId?: string,
  ): Promise<void> {
    const existing = await this.prisma.term.findFirst({
      where: {
        tenantId,
        academicYearId,
        name,
        ...(excludeTermId ? { NOT: { id: excludeTermId } } : {}),
      },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException('A term with this name already exists in this academic year');
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
    throw new ForbiddenException('Only administrators can manage terms');
  }

  private assertCanAdmin(role: string): void {
    if (role === 'SUPER_ADMIN' || role === 'ADMIN') {
      return;
    }
    throw new ForbiddenException('Only super admins and admins can delete terms');
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

  private rethrowTermWriteError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        throw new ConflictException('A term with this name already exists in this academic year');
      }

      if (error.code === 'P2025') {
        throw new NotFoundException('Term or related entity not found');
      }

      if (error.code === 'P2003') {
        throw new ConflictException('Related record does not exist');
      }
    }

    throw error;
  }

  private toTermSummary(record: TermSummaryRecord): TermSummary {
    return {
      id: record.id,
      tenantId: record.tenantId,
      name: record.name,
      academicYearId: record.academicYearId,
      startDate: this.toDateOnly(record.startDate),
      endDate: this.toDateOnly(record.endDate),
      status: record.status,
      isCurrent: record.isCurrent,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
      academicYear: {
        id: record.academicYear.id,
        name: record.academicYear.name,
      },
    };
  }
}
