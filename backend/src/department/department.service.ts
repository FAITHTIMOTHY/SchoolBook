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
  CreateDepartmentInput,
  DepartmentActorContext,
  DepartmentSummary,
  ListDepartmentsQuery,
  PaginatedDepartments,
  UpdateDepartmentInput,
} from './department.types.js';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

const departmentSummarySelect = {
  id: true,
  tenantId: true,
  name: true,
  code: true,
  description: true,
  headId: true,
  createdAt: true,
  updatedAt: true,
  head: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      employeeNumber: true,
      email: true,
    },
  },
  _count: {
    select: {
      staff: true,
      subjects: true,
    },
  },
} satisfies Prisma.DepartmentSelect;

type DepartmentSummaryRecord = Prisma.DepartmentGetPayload<{
  select: typeof departmentSummarySelect;
}>;

@Injectable()
export class DepartmentService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string, query: ListDepartmentsQuery): Promise<PaginatedDepartments> {
    this.assertTenantContext(tenantId);

    const page = Math.max(1, Math.trunc(query.page ?? 1));
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, Math.trunc(query.pageSize ?? DEFAULT_PAGE_SIZE)),
    );

    const where = this.buildListWhere(tenantId, query);
    const orderBy: Prisma.DepartmentOrderByWithRelationInput = {
      [query.sortBy ?? 'name']: query.sortOrder ?? 'asc',
    };

    const [records, total] = await this.prisma.$transaction([
      this.prisma.department.findMany({
        where,
        select: departmentSummarySelect,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.department.count({ where }),
    ]);

    return {
      data: records.map((record) => this.toDepartmentSummary(record)),
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  }

  async getById(tenantId: string, departmentId: string): Promise<DepartmentSummary> {
    this.assertTenantContext(tenantId);

    const department = await this.prisma.department.findFirst({
      where: { id: departmentId, tenantId },
      select: departmentSummarySelect,
    });

    if (!department) {
      throw new NotFoundException('Department not found');
    }

    return this.toDepartmentSummary(department);
  }

  async create(actor: DepartmentActorContext, input: CreateDepartmentInput): Promise<DepartmentSummary> {
    this.assertTenantContext(actor.tenantId);
    await this.assertActiveTenant(actor.tenantId);
    this.assertCanManage(actor.role);

    const name = input.name.trim();
    await this.assertNameAvailable(actor.tenantId, name);

    if (input.code) {
      const code = input.code.trim();
      await this.assertCodeAvailable(actor.tenantId, code);
    }

    if (input.headId) {
      await this.assertHeadLinkable(actor.tenantId, input.headId);
    }

    try {
      const department = await this.prisma.department.create({
        data: {
          tenantId: actor.tenantId,
          name,
          code: input.code ? input.code.trim() : null,
          description: this.normalizeNullableString(input.description),
          headId: input.headId ?? null,
        },
        select: departmentSummarySelect,
      });

      return this.toDepartmentSummary(department);
    } catch (error) {
      this.rethrowDepartmentWriteError(error);
    }
  }

  async update(
    actor: DepartmentActorContext,
    departmentId: string,
    input: UpdateDepartmentInput,
  ): Promise<DepartmentSummary> {
    this.assertTenantContext(actor.tenantId);
    await this.assertActiveTenant(actor.tenantId);
    this.assertCanManage(actor.role);

    const existing = await this.prisma.department.findFirst({
      where: { id: departmentId, tenantId: actor.tenantId },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException('Department not found');
    }

    const data: Prisma.DepartmentUncheckedUpdateInput = {};

    if (input.name !== undefined) {
      const name = input.name.trim();
      await this.assertNameAvailable(actor.tenantId, name, departmentId);
      data.name = name;
    }

    if (input.code !== undefined) {
      if (input.code) {
        const code = input.code.trim();
        await this.assertCodeAvailable(actor.tenantId, code, departmentId);
        data.code = code;
      } else {
        data.code = null;
      }
    }

    if (input.description !== undefined) {
      data.description = this.normalizeNullableString(input.description);
    }

    if (input.headId !== undefined) {
      if (input.headId) {
        await this.assertHeadLinkable(actor.tenantId, input.headId, departmentId);
      }
      data.headId = input.headId;
    }

    try {
      const department = await this.prisma.department.update({
        where: { id: departmentId, tenantId: actor.tenantId },
        data,
        select: departmentSummarySelect,
      });

      return this.toDepartmentSummary(department);
    } catch (error) {
      this.rethrowDepartmentWriteError(error);
    }
  }

  async setHead(
    actor: DepartmentActorContext,
    departmentId: string,
    headId: string | null,
  ): Promise<DepartmentSummary> {
    this.assertTenantContext(actor.tenantId);
    await this.assertActiveTenant(actor.tenantId);
    this.assertCanManage(actor.role);

    const existing = await this.prisma.department.findFirst({
      where: { id: departmentId, tenantId: actor.tenantId },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException('Department not found');
    }

    if (headId) {
      await this.assertHeadLinkable(actor.tenantId, headId, departmentId);
    }

    const department = await this.prisma.department.update({
      where: { id: departmentId, tenantId: actor.tenantId },
      data: { headId },
      select: departmentSummarySelect,
    });

    return this.toDepartmentSummary(department);
  }

  async delete(actor: DepartmentActorContext, departmentId: string): Promise<void> {
    this.assertTenantContext(actor.tenantId);
    await this.assertActiveTenant(actor.tenantId);
    this.assertCanAdmin(actor.role);

    const existing = await this.prisma.department.findFirst({
      where: { id: departmentId, tenantId: actor.tenantId },
      select: { id: true, _count: { select: { staff: true, subjects: true } } },
    });

    if (!existing) {
      throw new NotFoundException('Department not found');
    }

    if (existing._count.staff > 0 || existing._count.subjects > 0) {
      throw new ConflictException('Cannot delete department with assigned staff or subjects');
    }

    try {
      await this.prisma.department.delete({
        where: { id: departmentId, tenantId: actor.tenantId },
      });
    } catch (error) {
      this.rethrowDepartmentWriteError(error);
    }
  }

  private buildListWhere(tenantId: string, query: ListDepartmentsQuery): Prisma.DepartmentWhereInput {
    const where: Prisma.DepartmentWhereInput = { tenantId };

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

  private async assertNameAvailable(
    tenantId: string,
    name: string,
    excludeDepartmentId?: string,
  ): Promise<void> {
    const existing = await this.prisma.department.findFirst({
      where: {
        tenantId,
        name,
        ...(excludeDepartmentId ? { NOT: { id: excludeDepartmentId } } : {}),
      },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException('A department with this name already exists');
    }
  }

  private async assertCodeAvailable(
    tenantId: string,
    code: string,
    excludeDepartmentId?: string,
  ): Promise<void> {
    if (!code) {
      return;
    }

    const existing = await this.prisma.department.findFirst({
      where: {
        tenantId,
        code,
        ...(excludeDepartmentId ? { NOT: { id: excludeDepartmentId } } : {}),
      },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException('A department with this code already exists');
    }
  }

  private async assertHeadLinkable(
    tenantId: string,
    headId: string,
    excludeDepartmentId?: string,
  ): Promise<void> {
    const staff = await this.prisma.staff.findFirst({
      where: { id: headId, tenantId },
      select: { id: true, departmentId: true },
    });

    if (!staff) {
      throw new NotFoundException('Staff member not found');
    }

    const existingDepartment = await this.prisma.department.findFirst({
      where: {
        tenantId,
        headId,
        ...(excludeDepartmentId ? { NOT: { id: excludeDepartmentId } } : {}),
      },
      select: { id: true },
    });

    if (existingDepartment) {
      throw new ConflictException('Staff member is already head of another department');
    }
  }

  private assertCanManage(role: string): void {
    if (role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'PRINCIPAL') {
      return;
    }
    throw new ForbiddenException('Only administrators can manage departments');
  }

  private assertCanAdmin(role: string): void {
    if (role === 'SUPER_ADMIN' || role === 'ADMIN') {
      return;
    }
    throw new ForbiddenException('Only super admins and admins can delete departments');
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

  private rethrowDepartmentWriteError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        throw new ConflictException('A department with this name or code already exists');
      }

      if (error.code === 'P2025') {
        throw new NotFoundException('Department or related entity not found');
      }

      if (error.code === 'P2003') {
        throw new ConflictException('Related record does not exist');
      }
    }

    throw error;
  }

  private toDepartmentSummary(record: DepartmentSummaryRecord): DepartmentSummary {
    return {
      id: record.id,
      tenantId: record.tenantId,
      name: record.name,
      code: record.code,
      description: record.description,
      headId: record.headId,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
      head: record.head
        ? {
            id: record.head.id,
            firstName: record.head.firstName,
            lastName: record.head.lastName,
            employeeNumber: record.head.employeeNumber,
            email: record.head.email,
          }
        : null,
      _count: {
        staff: record._count.staff,
        subjects: record._count.subjects,
      },
    };
  }
}
