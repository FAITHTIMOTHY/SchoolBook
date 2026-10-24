import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  CreateUserInput,
  ListUsersQuery,
  PaginatedUsers,
  UpdateOwnProfileInput,
  UpdateUserInput,
  UserActorContext,
  UserProfile,
} from './users.types.js';

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

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

const userProfileSelect = {
  id: true,
  tenantId: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  avatarUrl: true,
  role: true,
  isActive: true,
  emailVerifiedAt: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  staff: {
    select: {
      id: true,
      employeeNumber: true,
    },
  },
  student: {
    select: {
      id: true,
      admissionNumber: true,
    },
  },
  guardian: {
    select: {
      id: true,
      phone: true,
    },
  },
} satisfies Prisma.UserSelect;

type UserProfileRecord = Prisma.UserGetPayload<{
  select: typeof userProfileSelect;
}>;

type ManageableUserRecord = {
  id: string;
  role: UserRole;
  isActive: boolean;
};

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lists users for the verified tenant only. tenantId is supplied by the
   * controller from the signed JWT, never from request input.
   */
  async list(tenantId: string, query: ListUsersQuery): Promise<PaginatedUsers> {
    this.assertTenantContext(tenantId);

    const page = Math.max(1, Math.trunc(query.page ?? 1));
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, Math.trunc(query.pageSize ?? DEFAULT_PAGE_SIZE)),
    );

    const where = this.buildListWhere(tenantId, query);
    const orderBy: Prisma.UserOrderByWithRelationInput = {
      [query.sortBy ?? 'createdAt']: query.sortOrder ?? 'desc',
    };

    const [records, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: userProfileSelect,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: records.map((record) => this.toUserProfile(record)),
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  }

  async getById(tenantId: string, userId: string): Promise<UserProfile> {
    this.assertTenantContext(tenantId);

    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: userProfileSelect,
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.toUserProfile(user);
  }

  async create(
    actor: UserActorContext,
    input: CreateUserInput,
  ): Promise<UserProfile> {
    this.assertTenantContext(actor.tenantId);
    await this.assertActiveTenant(actor.tenantId);

    const role = input.role ?? UserRole.STUDENT;
    this.assertCanAssignRole(actor.role, role);

    const email = this.normalizeEmail(input.email);
    await this.assertEmailAvailable(actor.tenantId, email);
    await this.assertProfilesLinkable(actor.tenantId, input);

    const passwordHash = input.password
      ? await argon2.hash(input.password)
      : null;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            tenantId: actor.tenantId,
            email,
            firstName: input.firstName.trim(),
            lastName: input.lastName.trim(),
            phone: this.normalizeNullableString(input.phone),
            avatarUrl: this.normalizeNullableString(input.avatarUrl),
            role,
            isActive: input.isActive ?? true,
            passwordHash,
          },
          select: { id: true },
        });

        if (input.staffId) {
          await tx.staff.update({
            where: { id: input.staffId, tenantId: actor.tenantId },
            data: { userId: created.id },
            select: { id: true },
          });
        }

        if (input.studentId) {
          await tx.student.update({
            where: { id: input.studentId, tenantId: actor.tenantId },
            data: { userId: created.id },
            select: { id: true },
          });
        }

        if (input.guardianId) {
          await tx.guardian.update({
            where: { id: input.guardianId, tenantId: actor.tenantId },
            data: { userId: created.id },
            select: { id: true },
          });
        }

        const user = await tx.user.findFirst({
          where: { id: created.id, tenantId: actor.tenantId },
          select: userProfileSelect,
        });

        if (!user) {
          throw new NotFoundException('User not found');
        }

        return this.toUserProfile(user);
      });
    } catch (error) {
      this.rethrowUserConflict(error);
    }
  }

  async update(
    actor: UserActorContext,
    userId: string,
    input: UpdateUserInput,
  ): Promise<UserProfile> {
    this.assertTenantContext(actor.tenantId);
    await this.assertActiveTenant(actor.tenantId);
    await this.findManageableTarget(actor, userId);

    if (input.role !== undefined) {
      this.assertCanAssignRole(actor.role, input.role);
    }

    const data: Prisma.UserUncheckedUpdateInput = {};

    if (input.email !== undefined) {
      const email = this.normalizeEmail(input.email);
      await this.assertEmailAvailable(actor.tenantId, email, userId);
      data.email = email;
    }

    if (input.firstName !== undefined) {
      data.firstName = input.firstName.trim();
    }

    if (input.lastName !== undefined) {
      data.lastName = input.lastName.trim();
    }

    if (input.phone !== undefined) {
      data.phone = this.normalizeNullableString(input.phone);
    }

    if (input.avatarUrl !== undefined) {
      data.avatarUrl = this.normalizeNullableString(input.avatarUrl);
    }

    if (input.role !== undefined) {
      data.role = input.role;
    }

    try {
      const user = await this.prisma.user.update({
        where: { id: userId, tenantId: actor.tenantId },
        data,
        select: userProfileSelect,
      });

      return this.toUserProfile(user);
    } catch (error) {
      this.rethrowUserConflict(error);
    }
  }

  async updateSelf(
    tenantId: string,
    userId: string,
    input: UpdateOwnProfileInput,
  ): Promise<UserProfile> {
    this.assertTenantContext(tenantId);

    const existing = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException('User not found');
    }

    const data: Prisma.UserUncheckedUpdateInput = {};

    if (input.firstName !== undefined) {
      data.firstName = input.firstName.trim();
    }

    if (input.lastName !== undefined) {
      data.lastName = input.lastName.trim();
    }

    if (input.phone !== undefined) {
      data.phone = this.normalizeNullableString(input.phone);
    }

    if (input.avatarUrl !== undefined) {
      data.avatarUrl = this.normalizeNullableString(input.avatarUrl);
    }

    const user = await this.prisma.user.update({
      where: { id: userId, tenantId },
      data,
      select: userProfileSelect,
    });

    return this.toUserProfile(user);
  }

  async setActive(
    actor: UserActorContext,
    userId: string,
    isActive: boolean,
  ): Promise<UserProfile> {
    this.assertTenantContext(actor.tenantId);
    await this.assertActiveTenant(actor.tenantId);
    await this.findManageableTarget(actor, userId);

    const user = await this.prisma.user.update({
      where: { id: userId, tenantId: actor.tenantId },
      data: { isActive },
      select: userProfileSelect,
    });

    if (!isActive) {
      await this.revokeSessions(actor.tenantId, userId);
    }

    return this.toUserProfile(user);
  }

  /**
   * Soft-deactivates the account and revokes all refresh tokens. Hard deletes
   * are intentionally avoided because users own academic and financial records.
   */
  async remove(
    actor: UserActorContext,
    userId: string,
  ): Promise<UserProfile> {
    return this.setActive(actor, userId, false);
  }

  private buildListWhere(
    tenantId: string,
    query: ListUsersQuery,
  ): Prisma.UserWhereInput {
    const where: Prisma.UserWhereInput = { tenantId };

    if (query.role) {
      where.role = query.role;
    }

    if (typeof query.isActive === 'boolean') {
      where.isActive = query.isActive;
    }

    if (query.search) {
      const search = query.search.trim();

      if (search) {
        where.OR = [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ];
      }
    }

    return where;
  }

  private async findManageableTarget(
    actor: UserActorContext,
    userId: string,
  ): Promise<ManageableUserRecord> {
    const target = await this.prisma.user.findFirst({
      where: { id: userId, tenantId: actor.tenantId },
      select: { id: true, role: true, isActive: true },
    });

    if (!target) {
      throw new NotFoundException('User not found');
    }

    this.assertCanManage(actor, target);

    return target;
  }

  private assertCanManage(
    actor: UserActorContext,
    target: ManageableUserRecord,
  ): void {
    if (actor.id === target.id) {
      throw new ForbiddenException(
        'Use the self-service profile endpoints to manage your own account',
      );
    }

    if (
      actor.role !== UserRole.SUPER_ADMIN &&
      ROLE_RANK[actor.role] <= ROLE_RANK[target.role]
    ) {
      throw new ForbiddenException(
        'You cannot manage a user with an equal or higher role',
      );
    }
  }

  private assertCanAssignRole(actorRole: UserRole, targetRole: UserRole): void {
    if (
      targetRole === UserRole.SUPER_ADMIN &&
      actorRole !== UserRole.SUPER_ADMIN
    ) {
      throw new ForbiddenException('Only a super admin can assign SUPER_ADMIN');
    }

    if (ROLE_RANK[targetRole] > ROLE_RANK[actorRole]) {
      throw new ForbiddenException('You cannot assign a higher role');
    }
  }

  private async assertEmailAvailable(
    tenantId: string,
    email: string,
    excludeUserId?: string,
  ): Promise<void> {
    const existing = await this.prisma.user.findFirst({
      where: {
        tenantId,
        email,
        ...(excludeUserId ? { NOT: { id: excludeUserId } } : {}),
      },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException('A user with this email already exists');
    }
  }

  private async assertProfilesLinkable(
    tenantId: string,
    input: CreateUserInput,
  ): Promise<void> {
    if (input.staffId) {
      const staff = await this.prisma.staff.findFirst({
        where: { id: input.staffId, tenantId },
        select: { userId: true },
      });

      if (!staff) {
        throw new NotFoundException('Staff profile not found');
      }

      if (staff.userId) {
        throw new ConflictException(
          'Staff profile is already linked to a user',
        );
      }
    }

    if (input.studentId) {
      const student = await this.prisma.student.findFirst({
        where: { id: input.studentId, tenantId },
        select: { userId: true },
      });

      if (!student) {
        throw new NotFoundException('Student profile not found');
      }

      if (student.userId) {
        throw new ConflictException(
          'Student profile is already linked to a user',
        );
      }
    }

    if (input.guardianId) {
      const guardian = await this.prisma.guardian.findFirst({
        where: { id: input.guardianId, tenantId },
        select: { userId: true },
      });

      if (!guardian) {
        throw new NotFoundException('Guardian profile not found');
      }

      if (guardian.userId) {
        throw new ConflictException(
          'Guardian profile is already linked to a user',
        );
      }
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

  private async revokeSessions(
    tenantId: string,
    userId: string,
  ): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: {
        tenantId,
        userId,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
  }

  private assertTenantContext(tenantId: string): void {
    if (!tenantId || !tenantId.trim()) {
      throw new UnauthorizedException('Tenant context missing');
    }
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

  private rethrowUserConflict(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        throw new ConflictException(
          'A user with this email or a conflicting profile link already exists',
        );
      }

      if (error.code === 'P2025') {
        throw new NotFoundException('User or linked profile not found');
      }
    }

    throw error;
  }

  private toUserProfile(user: UserProfileRecord): UserProfile {
    return {
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      role: user.role,
      isActive: user.isActive,
      emailVerifiedAt: user.emailVerifiedAt
        ? user.emailVerifiedAt.toISOString()
        : null,
      lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      staff: user.staff
        ? {
            id: user.staff.id,
            employeeNumber: user.staff.employeeNumber,
          }
        : null,
      student: user.student
        ? {
            id: user.student.id,
            admissionNumber: user.student.admissionNumber,
          }
        : null,
      guardian: user.guardian
        ? {
            id: user.guardian.id,
            phone: user.guardian.phone,
          }
        : null,
    };
  }
}
