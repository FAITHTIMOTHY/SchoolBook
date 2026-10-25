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
  CreateSubjectInput,
  ListSubjectsQuery,
  PaginatedSubjects,
  SubjectActorContext,
  SubjectSummary,
  UpdateSubjectInput,
} from './subject.types.js';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

const subjectSummarySelect = {
  id: true,
  tenantId: true,
  name: true,
  code: true,
  description: true,
  credits: true,
  isCore: true,
  departmentId: true,
  createdAt: true,
  updatedAt: true,
  department: {
    select: {
      id: true,
      name: true,
      code: true,
    },
  },
  _count: {
    select: {
      classSubjects: true,
      timetableEntries: true,
      exams: true,
    },
  },
} satisfies Prisma.SubjectSelect;

type SubjectSummaryRecord = Prisma.SubjectGetPayload<{
  select: typeof subjectSummarySelect;
}>;

@Injectable()
export class SubjectService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string, query: ListSubjectsQuery): Promise<PaginatedSubjects> {
    this.assertTenantContext(tenantId);

    const page = Math.max(1, Math.trunc(query.page ?? 1));
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, Math.trunc(query.pageSize ?? DEFAULT_PAGE_SIZE)),
    );

    const where = this.buildListWhere(tenantId, query);
    const orderBy: Prisma.SubjectOrderByWithRelationInput = {
      [query.sortBy ?? 'name']: query.sortOrder ?? 'asc',
    };

    const [records, total] = await this.prisma.$transaction([
      this.prisma.subject.findMany({
        where,
        select: subjectSummarySelect,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.subject.count({ where }),
    ]);

    return {
      data: records.map((record) => this.toSubjectSummary(record)),
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  }

  async getById(tenantId: string, subjectId: string): Promise<SubjectSummary> {
    this.assertTenantContext(tenantId);

    const subject = await this.prisma.subject.findFirst({
      where: { id: subjectId, tenantId },
      select: subjectSummarySelect,
    });

    if (!subject) {
      throw new NotFoundException('Subject not found');
    }

    return this.toSubjectSummary(subject);
  }

  async create(actor: SubjectActorContext, input: CreateSubjectInput): Promise<SubjectSummary> {
    this.assertTenantContext(actor.tenantId);
    await this.assertActiveTenant(actor.tenantId);
    this.assertCanManage(actor.role);

    const name = input.name.trim();
    const code = input.code.trim().toUpperCase();

    await this.assertCodeAvailable(actor.tenantId, code);

    if (input.departmentId) {
      await this.assertDepartmentInTenant(actor.tenantId, input.departmentId);
    }

    try {
      const subject = await this.prisma.subject.create({
        data: {
          tenantId: actor.tenantId,
          name,
          code,
          description: this.normalizeNullableString(input.description),
          credits: input.credits ?? null,
          isCore: input.isCore ?? true,
          departmentId: input.departmentId ?? null,
        },
        select: subjectSummarySelect,
      });

      return this.toSubjectSummary(subject);
    } catch (error) {
      this.rethrowSubjectWriteError(error);
    }
  }

  async update(
    actor: SubjectActorContext,
    subjectId: string,
    input: UpdateSubjectInput,
  ): Promise<SubjectSummary> {
    this.assertTenantContext(actor.tenantId);
    await this.assertActiveTenant(actor.tenantId);
    this.assertCanManage(actor.role);

    const existing = await this.prisma.subject.findFirst({
      where: { id: subjectId, tenantId: actor.tenantId },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException('Subject not found');
    }

    const data: Prisma.SubjectUncheckedUpdateInput = {};

    if (input.name !== undefined) {
      data.name = input.name.trim();
    }

    if (input.code !== undefined) {
      const code = input.code.trim().toUpperCase();
      await this.assertCodeAvailable(actor.tenantId, code, subjectId);
      data.code = code;
    }

    if (input.description !== undefined) {
      data.description = this.normalizeNullableString(input.description);
    }

    if (input.credits !== undefined) {
      data.credits = input.credits;
    }

    if (input.isCore !== undefined) {
      data.isCore = input.isCore;
    }

    if (input.departmentId !== undefined) {
      if (input.departmentId) {
        await this.assertDepartmentInTenant(actor.tenantId, input.departmentId);
      }
      data.departmentId = input.departmentId;
    }

    try {
      const subject = await this.prisma.subject.update({
        where: { id: subjectId, tenantId: actor.tenantId },
        data,
        select: subjectSummarySelect,
      });

      return this.toSubjectSummary(subject);
    } catch (error) {
      this.rethrowSubjectWriteError(error);
    }
  }

  async setDepartment(
    actor: SubjectActorContext,
    subjectId: string,
    departmentId: string | null,
  ): Promise<SubjectSummary> {
    this.assertTenantContext(actor.tenantId);
    await this.assertActiveTenant(actor.tenantId);
    this.assertCanManage(actor.role);

    const existing = await this.prisma.subject.findFirst({
      where: { id: subjectId, tenantId: actor.tenantId },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException('Subject not found');
    }

    if (departmentId) {
      await this.assertDepartmentInTenant(actor.tenantId, departmentId);
    }

    const subject = await this.prisma.subject.update({
      where: { id: subjectId, tenantId: actor.tenantId },
      data: { departmentId },
      select: subjectSummarySelect,
    });

    return this.toSubjectSummary(subject);
  }

  async delete(actor: SubjectActorContext, subjectId: string): Promise<void> {
    this.assertTenantContext(actor.tenantId);
    await this.assertActiveTenant(actor.tenantId);
    this.assertCanAdmin(actor.role);

    const existing = await this.prisma.subject.findFirst({
      where: { id: subjectId, tenantId: actor.tenantId },
      select: { id: true, _count: { select: { classSubjects: true, timetableEntries: true, exams: true } } },
    });

    if (!existing) {
      throw new NotFoundException('Subject not found');
    }

    if (
      existing._count.classSubjects > 0 ||
      existing._count.timetableEntries > 0 ||
      existing._count.exams > 0
    ) {
      throw new ConflictException('Cannot delete subject with assigned classes, timetable, or exams');
    }

    try {
      await this.prisma.subject.delete({
        where: { id: subjectId, tenantId: actor.tenantId },
      });
    } catch (error) {
      this.rethrowSubjectWriteError(error);
    }
  }

  private buildListWhere(tenantId: string, query: ListSubjectsQuery): Prisma.SubjectWhereInput {
    const where: Prisma.SubjectWhereInput = { tenantId };

    if (query.departmentId) {
      where.departmentId = query.departmentId;
    }

    if (typeof query.isCore === 'boolean') {
      where.isCore = query.isCore;
    }

    if (query.search) {
      const search = query.search.trim();

      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { code: { contains: search, mode: 'insensitive' } },
        ];
      }
    }

    return where;
  }

  private async assertCodeAvailable(
    tenantId: string,
    code: string,
    excludeSubjectId?: string,
  ): Promise<void> {
    const existing = await this.prisma.subject.findFirst({
      where: {
        tenantId,
        code,
        ...(excludeSubjectId ? { NOT: { id: excludeSubjectId } } : {}),
      },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException('A subject with this code already exists');
    }
  }

  private async assertDepartmentInTenant(tenantId: string, departmentId: string): Promise<void> {
    const department = await this.prisma.department.findFirst({
      where: { id: departmentId, tenantId },
      select: { id: true },
    });

    if (!department) {
      throw new NotFoundException('Department not found');
    }
  }

  private assertCanManage(role: string): void {
    if (role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'PRINCIPAL') {
      return;
    }
    throw new ForbiddenException('Only administrators can manage subjects');
  }

  private assertCanAdmin(role: string): void {
    if (role === 'SUPER_ADMIN' || role === 'ADMIN') {
      return;
    }
    throw new ForbiddenException('Only super admins and admins can delete subjects');
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

  private rethrowSubjectWriteError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        throw new ConflictException('A subject with this code already exists');
      }

      if (error.code === 'P2025') {
        throw new NotFoundException('Subject or related entity not found');
      }

      if (error.code === 'P2003') {
        throw new ConflictException('Related record does not exist');
      }
    }

    throw error;
  }

  private toSubjectSummary(record: SubjectSummaryRecord): SubjectSummary {
    return {
      id: record.id,
      tenantId: record.tenantId,
      name: record.name,
      code: record.code,
      description: record.description,
      credits: record.credits,
      isCore: record.isCore,
      departmentId: record.departmentId,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
      department: record.department
        ? {
            id: record.department.id,
            name: record.department.name,
            code: record.department.code,
          }
        : null,
      _count: {
        classSubjects: record._count.classSubjects,
        timetableEntries: record._count.timetableEntries,
        exams: record._count.exams,
      },
    };
  }
}
