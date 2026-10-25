import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { EmploymentType, Prisma, StaffStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  CreateStaffInput,
  ListStaffQuery,
  PaginatedStaff,
  StaffActorContext,
  StaffSummary,
  UpdateStaffInput,
} from './staff.types.js';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

const ROLE_RANK: Record<UserRole, number> = {
  SUPER_ADMIN: 100,
  ADMIN: 90,
  PRINCIPAL: 70,
  VICE_PRINCIPAL: 60,
  ACCOUNTANT: 50,
  TEACHER: 40,
  LIBRARIAN: 30,
  STUDENT: 20,
  PARENT: 10,
  GUARDIAN: 10,
};

const staffSummarySelect = {
  id: true,
  tenantId: true,
  userId: true,
  employeeNumber: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  gender: true,
  dateOfBirth: true,
  hireDate: true,
  employmentType: true,
  status: true,
  jobTitle: true,
  qualification: true,
  address: true,
  emergencyContactName: true,
  emergencyContactPhone: true,
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
  user: {
    select: {
      id: true,
      email: true,
      role: true,
      isActive: true,
    },
  },
  headedDepartment: {
    select: {
      id: true,
      name: true,
      code: true,
    },
  },
} satisfies Prisma.StaffSelect;

type StaffSummaryRecord = Prisma.StaffGetPayload<{
  select: typeof staffSummarySelect;
}>;

@Injectable()
export class StaffService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string, query: ListStaffQuery): Promise<PaginatedStaff> {
    this.assertTenantContext(tenantId);

    const page = Math.max(1, Math.trunc(query.page ?? 1));
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, Math.trunc(query.pageSize ?? DEFAULT_PAGE_SIZE)),
    );

    const where = this.buildListWhere(tenantId, query);
    const orderBy: Prisma.StaffOrderByWithRelationInput = {
      [query.sortBy ?? 'createdAt']: query.sortOrder ?? 'desc',
    };

    const [records, total] = await this.prisma.$transaction([
      this.prisma.staff.findMany({
        where,
        select: staffSummarySelect,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.staff.count({ where }),
    ]);

    return {
      data: records.map((record) => this.toStaffSummary(record)),
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
    staffId: string,
    actor?: StaffActorContext,
  ): Promise<StaffSummary> {
    this.assertTenantContext(tenantId);

    const staff = await this.prisma.staff.findFirst({
      where: { id: staffId, tenantId },
      select: staffSummarySelect,
    });

    if (!staff) {
      throw new NotFoundException('Staff not found');
    }

    if (actor) {
      this.assertCanView(actor, staff);
    }

    return this.toStaffSummary(staff);
  }

  async create(actor: StaffActorContext, input: CreateStaffInput): Promise<StaffSummary> {
    this.assertTenantContext(actor.tenantId);
    await this.assertActiveTenant(actor.tenantId);
    this.assertCanCreate(actor.role);

    const employeeNumber = input.employeeNumber.trim();
    await this.assertEmployeeNumberAvailable(actor.tenantId, employeeNumber);

    const email = input.email ? this.normalizeEmail(input.email) : null;
    if (email) {
      await this.assertEmailAvailable(actor.tenantId, email);
    }

    if (input.departmentId) {
      await this.assertDepartmentInTenant(actor.tenantId, input.departmentId);
    }

    if (input.userId) {
      await this.assertUserLinkable(actor.tenantId, input.userId);
    }

    try {
      const staff = await this.prisma.staff.create({
        data: {
          tenantId: actor.tenantId,
          employeeNumber,
          firstName: input.firstName.trim(),
          lastName: input.lastName.trim(),
          email,
          phone: this.normalizeNullableString(input.phone),
          gender: input.gender ?? null,
          dateOfBirth: input.dateOfBirth ? this.toDate(input.dateOfBirth) : null,
          hireDate: this.toDate(input.hireDate),
          employmentType: input.employmentType ?? EmploymentType.FULL_TIME,
          status: input.status ?? StaffStatus.ACTIVE,
          jobTitle: this.normalizeNullableString(input.jobTitle),
          qualification: this.normalizeNullableString(input.qualification),
          address: this.normalizeNullableString(input.address),
          emergencyContactName: this.normalizeNullableString(input.emergencyContactName),
          emergencyContactPhone: this.normalizeNullableString(input.emergencyContactPhone),
          departmentId: input.departmentId ?? null,
          userId: input.userId ?? null,
        },
        select: staffSummarySelect,
      });

      return this.toStaffSummary(staff);
    } catch (error) {
      this.rethrowStaffWriteError(error);
    }
  }

  async update(
    actor: StaffActorContext,
    staffId: string,
    input: UpdateStaffInput,
  ): Promise<StaffSummary> {
    this.assertTenantContext(actor.tenantId);
    await this.assertActiveTenant(actor.tenantId);

    const existing = await this.prisma.staff.findFirst({
      where: { id: staffId, tenantId: actor.tenantId },
      select: { id: true, userId: true },
    });

    if (!existing) {
      throw new NotFoundException('Staff not found');
    }

    this.assertCanEdit(actor.role);

    const data: Prisma.StaffUncheckedUpdateInput = {};

    if (input.employeeNumber !== undefined) {
      throw new BadRequestException('employeeNumber cannot be changed');
    }

    if (input.userId !== undefined) {
      throw new BadRequestException('Use link-user/unlink-user endpoints to manage user linkage');
    }

    if (input.firstName !== undefined) {
      data.firstName = input.firstName.trim();
    }

    if (input.lastName !== undefined) {
      data.lastName = input.lastName.trim();
    }

    if (input.email !== undefined) {
      const email = input.email ? this.normalizeEmail(input.email) : null;
      if (email) {
        await this.assertEmailAvailable(actor.tenantId, email, staffId);
      }
      data.email = email;
    }

    if (input.phone !== undefined) {
      data.phone = this.normalizeNullableString(input.phone);
    }

    if (input.gender !== undefined) {
      data.gender = input.gender;
    }

    if (input.dateOfBirth !== undefined) {
      data.dateOfBirth = input.dateOfBirth ? this.toDate(input.dateOfBirth) : null;
    }

    if (input.hireDate !== undefined) {
      data.hireDate = this.toDate(input.hireDate);
    }

    if (input.employmentType !== undefined) {
      data.employmentType = input.employmentType;
    }

    if (input.status !== undefined) {
      throw new BadRequestException('Use the status endpoint to update staff status');
    }

    if (input.jobTitle !== undefined) {
      data.jobTitle = this.normalizeNullableString(input.jobTitle);
    }

    if (input.qualification !== undefined) {
      data.qualification = this.normalizeNullableString(input.qualification);
    }

    if (input.address !== undefined) {
      data.address = this.normalizeNullableString(input.address);
    }

    if (input.emergencyContactName !== undefined) {
      data.emergencyContactName = this.normalizeNullableString(input.emergencyContactName);
    }

    if (input.emergencyContactPhone !== undefined) {
      data.emergencyContactPhone = this.normalizeNullableString(input.emergencyContactPhone);
    }

    if (input.departmentId !== undefined) {
      if (input.departmentId) {
        await this.assertDepartmentInTenant(actor.tenantId, input.departmentId);
      }
      data.departmentId = input.departmentId;
    }

    try {
      const staff = await this.prisma.staff.update({
        where: { id: staffId, tenantId: actor.tenantId },
        data,
        select: staffSummarySelect,
      });

      return this.toStaffSummary(staff);
    } catch (error) {
      this.rethrowStaffWriteError(error);
    }
  }

  async setStatus(
    actor: StaffActorContext,
    staffId: string,
    status: StaffStatus,
  ): Promise<StaffSummary> {
    this.assertTenantContext(actor.tenantId);
    await this.assertActiveTenant(actor.tenantId);
    this.assertCanAdmin(actor.role);

    const existing = await this.prisma.staff.findFirst({
      where: { id: staffId, tenantId: actor.tenantId },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException('Staff not found');
    }

    const staff = await this.prisma.staff.update({
      where: { id: staffId, tenantId: actor.tenantId },
      data: { status },
      select: staffSummarySelect,
    });

    return this.toStaffSummary(staff);
  }

  async linkUser(
    actor: StaffActorContext,
    staffId: string,
    userId: string,
  ): Promise<StaffSummary> {
    this.assertTenantContext(actor.tenantId);
    await this.assertActiveTenant(actor.tenantId);
    this.assertCanAdmin(actor.role);

    const [staff, user] = await Promise.all([
      this.prisma.staff.findFirst({
        where: { id: staffId, tenantId: actor.tenantId },
        select: { id: true, userId: true },
      }),
      this.prisma.user.findFirst({
        where: { id: userId, tenantId: actor.tenantId },
        select: { id: true },
      }),
    ]);

    if (!staff) {
      throw new NotFoundException('Staff not found');
    }

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (staff.userId) {
      throw new ConflictException('Staff is already linked to a user');
    }

    await this.assertUserLinkable(actor.tenantId, userId, staffId);

    const updated = await this.prisma.staff.update({
      where: { id: staffId, tenantId: actor.tenantId },
      data: { userId },
      select: staffSummarySelect,
    });

    return this.toStaffSummary(updated);
  }

  async unlinkUser(actor: StaffActorContext, staffId: string): Promise<StaffSummary> {
    this.assertTenantContext(actor.tenantId);
    await this.assertActiveTenant(actor.tenantId);
    this.assertCanAdmin(actor.role);

    const staff = await this.prisma.staff.findFirst({
      where: { id: staffId, tenantId: actor.tenantId },
      select: { id: true, userId: true },
    });

    if (!staff) {
      throw new NotFoundException('Staff not found');
    }

    if (!staff.userId) {
      throw new BadRequestException('Staff is not linked to a user');
    }

    const updated = await this.prisma.staff.update({
      where: { id: staffId, tenantId: actor.tenantId },
      data: { userId: null },
      select: staffSummarySelect,
    });

    return this.toStaffSummary(updated);
  }

  async setDepartmentHead(
    actor: StaffActorContext,
    staffId: string,
  ): Promise<StaffSummary> {
    this.assertTenantContext(actor.tenantId);
    await this.assertActiveTenant(actor.tenantId);
    this.assertCanAdmin(actor.role);

    const staff = await this.prisma.staff.findFirst({
      where: { id: staffId, tenantId: actor.tenantId },
      select: { id: true, departmentId: true },
    });

    if (!staff) {
      throw new NotFoundException('Staff not found');
    }

    if (!staff.departmentId) {
      throw new BadRequestException('Staff must be assigned to a department');
    }

    const department = await this.prisma.department.findFirst({
      where: { id: staff.departmentId, tenantId: actor.tenantId },
      select: { id: true, headId: true },
    });

    if (!department) {
      throw new NotFoundException('Department not found');
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        if (department.headId && department.headId !== staffId) {
          await tx.department.update({
            where: { id: department.id, tenantId: actor.tenantId },
            data: { headId: staffId },
            select: { id: true },
          });
        } else {
          await tx.department.update({
            where: { id: department.id, tenantId: actor.tenantId },
            data: { headId: staffId },
            select: { id: true },
          });
        }
      });
    } catch (error) {
      this.rethrowStaffWriteError(error);
    }

    const updated = await this.prisma.staff.findFirst({
      where: { id: staffId, tenantId: actor.tenantId },
      select: staffSummarySelect,
    });

    if (!updated) {
      throw new NotFoundException('Staff not found');
    }

    return this.toStaffSummary(updated);
  }

  async removeDepartmentHead(
    actor: StaffActorContext,
    departmentId: string,
  ): Promise<void> {
    this.assertTenantContext(actor.tenantId);
    await this.assertActiveTenant(actor.tenantId);
    this.assertCanAdmin(actor.role);

    const department = await this.prisma.department.findFirst({
      where: { id: departmentId, tenantId: actor.tenantId },
      select: { id: true },
    });

    if (!department) {
      throw new NotFoundException('Department not found');
    }

    await this.prisma.department.update({
      where: { id: departmentId, tenantId: actor.tenantId },
      data: { headId: null },
      select: { id: true },
    });
  }

  private buildListWhere(tenantId: string, query: ListStaffQuery): Prisma.StaffWhereInput {
    const where: Prisma.StaffWhereInput = { tenantId };

    if (query.departmentId) {
      where.departmentId = query.departmentId;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.employmentType) {
      where.employmentType = query.employmentType;
    }

    if (query.search) {
      const search = query.search.trim();

      if (search) {
        where.OR = [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { employeeNumber: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ];
      }
    }

    return where;
  }

  private assertCanView(actor: StaffActorContext, staff: StaffSummaryRecord): void {
    if (this.isPrivileged(actor.role)) {
      return;
    }

    if (staff.userId && staff.userId === actor.id) {
      return;
    }

    throw new ForbiddenException('You do not have permission to view this staff record');
  }

  private assertCanCreate(role: UserRole): void {
    if (
      role === UserRole.SUPER_ADMIN ||
      role === UserRole.ADMIN ||
      role === UserRole.PRINCIPAL
    ) {
      return;
    }
    throw new ForbiddenException('Only administrators can create staff records');
  }

  private assertCanEdit(role: UserRole): void {
    if (
      role === UserRole.SUPER_ADMIN ||
      role === UserRole.ADMIN ||
      role === UserRole.PRINCIPAL
    ) {
      return;
    }
    throw new ForbiddenException('Only administrators can edit staff records');
  }

  private assertCanAdmin(role: UserRole): void {
    if (role === UserRole.SUPER_ADMIN || role === UserRole.ADMIN) {
      return;
    }
    throw new ForbiddenException('Only super admins and admins can perform this action');
  }

  private isPrivileged(role: UserRole): boolean {
    return (
      role === UserRole.SUPER_ADMIN ||
      role === UserRole.ADMIN ||
      role === UserRole.PRINCIPAL ||
      role === UserRole.VICE_PRINCIPAL ||
      role === UserRole.ACCOUNTANT
    );
  }

  private async assertEmployeeNumberAvailable(
    tenantId: string,
    employeeNumber: string,
    excludeStaffId?: string,
  ): Promise<void> {
    const existing = await this.prisma.staff.findFirst({
      where: {
        tenantId,
        employeeNumber,
        ...(excludeStaffId ? { NOT: { id: excludeStaffId } } : {}),
      },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException('A staff member with this employee number already exists');
    }
  }

  private async assertEmailAvailable(
    tenantId: string,
    email: string,
    excludeStaffId?: string,
  ): Promise<void> {
    const existing = await this.prisma.staff.findFirst({
      where: {
        tenantId,
        email,
        ...(excludeStaffId ? { NOT: { id: excludeStaffId } } : {}),
      },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException('A staff member with this email already exists');
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

  private async assertUserLinkable(
    tenantId: string,
    userId: string,
    excludeStaffId?: string,
  ): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const existingStaff = await this.prisma.staff.findFirst({
      where: {
        tenantId,
        userId,
        ...(excludeStaffId ? { NOT: { id: excludeStaffId } } : {}),
      },
      select: { id: true },
    });

    if (existingStaff) {
      throw new ConflictException('User is already linked to another staff member');
    }

    const existingStudent = await this.prisma.student.findFirst({
      where: { tenantId, userId },
      select: { id: true },
    });

    if (existingStudent) {
      throw new ConflictException('User is already linked to a student profile');
    }

    const existingGuardian = await this.prisma.guardian.findFirst({
      where: { tenantId, userId },
      select: { id: true },
    });

    if (existingGuardian) {
      throw new ConflictException('User is already linked to a guardian profile');
    }
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

  private toDateOnly(value: Date | null): string | null {
    if (!value) {
      return null;
    }
    return value.toISOString().slice(0, 10);
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private normalizeNullableString(value?: string | null): string | null {
    if (value === undefined || value === null) {
      return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private rethrowStaffWriteError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        throw new ConflictException('A staff record with this value already exists');
      }

      if (error.code === 'P2025') {
        throw new NotFoundException('Staff or related entity not found');
      }

      if (error.code === 'P2003') {
        throw new ConflictException('Related record does not exist');
      }
    }

    throw error;
  }

  private toStaffSummary(record: StaffSummaryRecord): StaffSummary {
    return {
      id: record.id,
      tenantId: record.tenantId,
      userId: record.userId,
      employeeNumber: record.employeeNumber,
      firstName: record.firstName,
      lastName: record.lastName,
      email: record.email,
      phone: record.phone,
      gender: record.gender,
      dateOfBirth: this.toDateOnly(record.dateOfBirth),
      hireDate: this.toDateOnly(record.hireDate) as string,
      employmentType: record.employmentType,
      status: record.status,
      jobTitle: record.jobTitle,
      qualification: record.qualification,
      address: record.address,
      emergencyContactName: record.emergencyContactName,
      emergencyContactPhone: record.emergencyContactPhone,
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
      user: record.user
        ? {
            id: record.user.id,
            email: record.user.email,
            role: record.user.role,
            isActive: record.user.isActive,
          }
        : null,
      headedDepartment: record.headedDepartment
        ? {
            id: record.headedDepartment.id,
            name: record.headedDepartment.name,
            code: record.headedDepartment.code,
          }
        : null,
    };
  }
}
