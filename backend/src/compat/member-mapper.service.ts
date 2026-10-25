import { Injectable } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { ADMIN_ROLES } from './compat.types.js';
import type {
  LegacyMember,
  LegacyMemberStatus,
  LegacyRole,
  MemberActor,
  MemberView,
} from './compat.types.js';

const DEFAULT_AVATAR = '/avatar-default.svg';

const MEMBER_LIMIT = 5000;

const STUDENT_INCLUDE = {
  user: { select: { email: true, avatarUrl: true } },
  guardians: {
    include: { guardian: true },
    orderBy: { isPrimary: 'desc' },
    take: 1,
  },
  enrollments: {
    where: { status: 'ACTIVE' },
    include: { classroom: true },
    orderBy: { enrollmentDate: 'desc' },
    take: 1,
  },
  portal: { select: { overallScore: true } },
  termPerformances: {
    orderBy: { updatedAt: 'desc' },
    take: 1,
    select: { percentage: true },
  },
} satisfies Prisma.StudentInclude;

const STAFF_INCLUDE = {
  user: { select: { email: true, avatarUrl: true, role: true } },
  department: { select: { id: true, name: true } },
} satisfies Prisma.StaffInclude;

const USER_SELECT = {
  id: true,
  tenantId: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  avatarUrl: true,
  role: true,
  isActive: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

export interface MemberFilters {
  search?: string;
  role?: LegacyRole;
  status?: LegacyMemberStatus;
  id?: string;
}

export interface SelfIds {
  userId: string;
  studentId: string | null;
  staffId: string | null;
}

export interface ResolvedMember {
  id: string;
  kind: 'STUDENT' | 'STAFF' | 'USER';
}

@Injectable()
export class MemberMapperService {
  constructor(private readonly prisma: PrismaService) {}

  async listMembers(
    tenantId: string,
    filters: MemberFilters,
    actor: MemberActor,
  ): Promise<MemberView[]> {
    const members = await this.fetchMembers(tenantId, filters);
    const selfIds = await this.getSelfIds(actor.id, tenantId);
    return members.map((member) => this.prune(member, actor, selfIds));
  }

  /** Unpruned list for internal recipient/attendance calculations. */
  async listRawMembers(
    tenantId: string,
    filters: MemberFilters = {},
  ): Promise<LegacyMember[]> {
    return this.fetchMembers(tenantId, filters);
  }

  async getMember(
    tenantId: string,
    id: string,
    actor: MemberActor,
  ): Promise<MemberView | null> {
    const member = await this.getMemberRaw(tenantId, id);
    if (!member) {
      return null;
    }

    const selfIds = await this.getSelfIds(actor.id, tenantId);
    return this.prune(member, actor, selfIds);
  }

  async getMemberRaw(tenantId: string, id: string): Promise<LegacyMember | null> {
    const members = await this.fetchMembers(tenantId, { id });
    return members[0] ?? null;
  }

  async getSelfIds(userId: string, tenantId: string): Promise<SelfIds> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: {
        id: true,
        student: { select: { id: true } },
        staff: { select: { id: true } },
      },
    });

    return {
      userId,
      studentId: user?.student?.id ?? null,
      staffId: user?.staff?.id ?? null,
    };
  }

  async resolveMember(
    tenantId: string,
    id: string,
  ): Promise<ResolvedMember | null> {
    const student = await this.prisma.student.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });
    if (student) {
      return { id: student.id, kind: 'STUDENT' };
    }

    const staff = await this.prisma.staff.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });
    if (staff) {
      return { id: staff.id, kind: 'STAFF' };
    }

    const user = await this.prisma.user.findFirst({
      where: {
        id,
        tenantId,
        role: { notIn: ['STUDENT', 'PARENT', 'GUARDIAN'] },
      },
      select: { id: true },
    });
    if (user) {
      return { id: user.id, kind: 'USER' };
    }

    return null;
  }

  async listMemberIds(tenantId: string): Promise<ResolvedMember[]> {
    const [students, staff, users] = await Promise.all([
      this.prisma.student.findMany({
        where: { tenantId, status: 'ACTIVE' },
        select: { id: true },
      }),
      this.prisma.staff.findMany({
        where: { tenantId, status: 'ACTIVE' },
        select: { id: true },
      }),
      this.prisma.user.findMany({
        where: {
          tenantId,
          isActive: true,
          role: { notIn: ['STUDENT', 'PARENT', 'GUARDIAN'] },
          staff: { is: null },
          student: { is: null },
        },
        select: { id: true },
      }),
    ]);

    return [
      ...students.map((row) => ({ id: row.id, kind: 'STUDENT' as const })),
      ...staff.map((row) => ({ id: row.id, kind: 'STAFF' as const })),
      ...users.map((row) => ({ id: row.id, kind: 'USER' as const })),
    ];
  }

  private async fetchMembers(
    tenantId: string,
    filters: MemberFilters,
  ): Promise<LegacyMember[]> {
    if (filters.id) {
      const [student, staff, user] = await Promise.all([
        this.prisma.student.findFirst({
          where: { id: filters.id, tenantId },
          include: STUDENT_INCLUDE,
        }),
        this.prisma.staff.findFirst({
          where: { id: filters.id, tenantId },
          include: STAFF_INCLUDE,
        }),
        this.prisma.user.findFirst({
          where: { id: filters.id, tenantId },
          select: USER_SELECT,
        }),
      ]);

      const members: LegacyMember[] = [];
      if (student) members.push(this.mapStudent(student));
      if (staff) members.push(this.mapStaff(staff));
      if (user) members.push(this.mapUser(user));
      return members;
    }

    const search = filters.search?.trim();
    const wantsStudents = !filters.role || filters.role === 'Student';
    const wantsStaff = !filters.role || filters.role !== 'Student';

    const studentWhere: Prisma.StudentWhereInput = { tenantId };
    if (filters.status === 'Active') {
      studentWhere.status = 'ACTIVE';
    }
    if (search) {
      studentWhere.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { admissionNumber: { contains: search, mode: 'insensitive' } },
      ];
    }

    const staffWhere: Prisma.StaffWhereInput = { tenantId };
    if (filters.status === 'Active') {
      staffWhere.status = 'ACTIVE';
    }
    if (search) {
      staffWhere.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { jobTitle: { contains: search, mode: 'insensitive' } },
      ];
    }

    const userWhere: Prisma.UserWhereInput = {
      tenantId,
      role: { notIn: ['STUDENT', 'PARENT', 'GUARDIAN'] },
      staff: { is: null },
      student: { is: null },
    };
    if (filters.status === 'Active') {
      userWhere.isActive = true;
    }
    if (search) {
      userWhere.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [students, staff, users] = await Promise.all([
      wantsStudents
        ? this.prisma.student.findMany({
            where: studentWhere,
            include: STUDENT_INCLUDE,
            take: MEMBER_LIMIT,
            orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
          })
        : Promise.resolve([]),
      wantsStaff
        ? this.prisma.staff.findMany({
            where: staffWhere,
            include: STAFF_INCLUDE,
            take: MEMBER_LIMIT,
            orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
          })
        : Promise.resolve([]),
      wantsStaff
        ? this.prisma.user.findMany({
            where: userWhere,
            select: USER_SELECT,
            take: MEMBER_LIMIT,
            orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
          })
        : Promise.resolve([]),
    ]);

    let members: LegacyMember[] = [
      ...students.map((row) => this.mapStudent(row)),
      ...staff.map((row) => this.mapStaff(row)),
      ...users.map((row) => this.mapUser(row)),
    ];

    if (filters.role) {
      members = members.filter((member) => member.role === filters.role);
    }

    if (filters.status) {
      members = members.filter((member) => member.status === filters.status);
    }

    if (search) {
      const query = search.toLowerCase();
      members = members.filter((member) =>
        [member.name, member.email, member.position].some((value) =>
          value?.toLowerCase().includes(query),
        ),
      );
    }

    members.sort((left, right) => left.name.localeCompare(right.name));
    return members;
  }

  private mapStudent(student: any): LegacyMember {
    const enrollment = student.enrollments?.[0];
    const classroom = enrollment?.classroom;
    const guardianLink = student.guardians?.[0];
    const guardian = guardianLink?.guardian;
    const percentage = student.termPerformances?.[0]?.percentage;
    const dateOfBirth = student.dateOfBirth
      ? new Date(student.dateOfBirth)
      : null;

    const academicScore =
      student.portal?.overallScore ??
      (percentage !== null && percentage !== undefined
        ? Math.round(Number(percentage))
        : undefined);

    return {
      id: student.id,
      tenant_id: student.tenantId,
      name: [student.firstName, student.lastName]
        .filter(Boolean)
        .join(' ')
        .trim(),
      email: student.email ?? student.user?.email ?? '',
      phone: student.phone ?? '',
      address: student.address ?? '',
      profile_picture_url:
        student.photoUrl ?? student.user?.avatarUrl ?? DEFAULT_AVATAR,
      dob_month: dateOfBirth ? dateOfBirth.getUTCMonth() + 1 : 1,
      dob_day: dateOfBirth ? dateOfBirth.getUTCDate() : 1,
      role: 'Student',
      position: classroom?.name ?? 'Student',
      unit_id: student.unitId ?? classroom?.id ?? null,
      status: student.status === 'ACTIVE' ? 'Active' : 'Inactive',
      joined_date: student.admissionDate
        ? new Date(student.admissionDate).toISOString()
        : new Date(student.createdAt).toISOString(),
      academic_score: academicScore,
      guardian_name: guardian
        ? `${guardian.firstName} ${guardian.lastName}`.trim()
        : undefined,
      guardian_email: guardian?.email ?? undefined,
      guardian_phone: guardian?.phone ?? undefined,
      user_id: student.userId ?? null,
      guardian_id: guardian?.id ?? null,
      guardian_user_id: guardian?.userId ?? null,
    };
  }

  private mapStaff(staff: any): LegacyMember {
    const dateOfBirth = staff.dateOfBirth ? new Date(staff.dateOfBirth) : null;

    return {
      id: staff.id,
      tenant_id: staff.tenantId,
      name: [staff.firstName, staff.lastName]
        .filter(Boolean)
        .join(' ')
        .trim(),
      email: staff.email ?? staff.user?.email ?? '',
      phone: staff.phone ?? '',
      address: staff.address ?? '',
      profile_picture_url: staff.user?.avatarUrl ?? DEFAULT_AVATAR,
      dob_month: dateOfBirth ? dateOfBirth.getUTCMonth() + 1 : 1,
      dob_day: dateOfBirth ? dateOfBirth.getUTCDate() : 1,
      role: toLegacyRole(staff.user?.role, staff.jobTitle),
      position: staff.jobTitle ?? 'Faculty Staff',
      unit_id: staff.departmentId ?? null,
      status: staff.status === 'ACTIVE' ? 'Active' : 'Inactive',
      joined_date: staff.hireDate
        ? new Date(staff.hireDate).toISOString()
        : new Date(staff.createdAt).toISOString(),
      office_location: staff.department?.name ?? undefined,
      specialization: staff.qualification ?? undefined,
      user_id: staff.userId ?? null,
    };
  }

  private mapUser(user: any): LegacyMember {
    return {
      id: user.id,
      tenant_id: user.tenantId,
      name: [user.firstName, user.lastName].filter(Boolean).join(' ').trim(),
      email: user.email ?? '',
      phone: user.phone ?? '',
      address: '',
      profile_picture_url: user.avatarUrl ?? DEFAULT_AVATAR,
      dob_month: 1,
      dob_day: 1,
      role: toLegacyRole(user.role, null),
      position: userRoleLabel(user.role),
      unit_id: null,
      status: user.isActive ? 'Active' : 'Inactive',
      joined_date: new Date(user.createdAt).toISOString(),
      user_id: user.id,
    };
  }

  private prune(
    member: LegacyMember,
    actor: MemberActor,
    selfIds: SelfIds,
  ): MemberView {
    const isAdmin = ADMIN_ROLES.includes(actor.role);
    const isSelf =
      member.id === selfIds.userId ||
      member.id === selfIds.studentId ||
      member.id === selfIds.staffId;

    if (isAdmin || isSelf) {
      return member;
    }

    return {
      id: member.id,
      tenant_id: member.tenant_id,
      name: member.name,
      profile_picture_url: member.profile_picture_url,
      role: member.role,
      position: member.position,
      unit_id: member.unit_id,
      status: member.status,
      academic_score: member.academic_score,
      office_location: member.office_location,
      office_hours: member.office_hours,
      bio: member.bio,
      specialization: member.specialization,
    };
  }
}

export function toLegacyRole(
  role?: UserRole | null,
  jobTitle?: string | null,
): LegacyRole {
  if (
    role === 'SUPER_ADMIN' ||
    role === 'ADMIN' ||
    role === 'PRINCIPAL' ||
    role === 'VICE_PRINCIPAL'
  ) {
    return 'Principal';
  }

  if (role === 'STUDENT' || role === 'PARENT' || role === 'GUARDIAN') {
    return 'Student';
  }

  const title = (jobTitle ?? '').toLowerCase();

  if (role === 'TEACHER' || role === 'LIBRARIAN' || role === 'ACCOUNTANT') {
    if (title.includes('counsel') || title.includes('guidance')) {
      return 'Counselor';
    }
    return 'Teacher';
  }

  if (title.includes('principal') || title.includes('head')) {
    return 'Principal';
  }
  if (title.includes('counsel') || title.includes('guidance')) {
    return 'Counselor';
  }

  return 'Teacher';
}

export function userRoleLabel(role: UserRole): string {
  const labels: Record<UserRole, string> = {
    SUPER_ADMIN: 'Super Administrator',
    ADMIN: 'Administrator',
    PRINCIPAL: 'Principal',
    VICE_PRINCIPAL: 'Vice Principal',
    TEACHER: 'Teacher',
    ACCOUNTANT: 'Accountant',
    LIBRARIAN: 'Librarian',
    STUDENT: 'Student',
    PARENT: 'Parent',
    GUARDIAN: 'Guardian',
  };

  return labels[role] ?? role;
}
