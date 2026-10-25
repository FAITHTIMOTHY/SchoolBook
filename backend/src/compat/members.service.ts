import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomInt } from 'crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { ADMIN_ROLES } from './compat.types.js';
import type {
  LegacyMemberStatus,
  LegacyRole,
  MemberActor,
  MemberView,
} from './compat.types.js';
import { MemberMapperService } from './member-mapper.service.js';

export interface MemberInput {
  name?: string;
  role?: LegacyRole;
  email?: string;
  phone?: string;
  address?: string;
  profile_picture_url?: string;
  dob_month?: number;
  dob_day?: number;
  position?: string;
  unit_id?: string | null;
  status?: LegacyMemberStatus;
  academic_score?: number;
  guardian_name?: string;
  guardian_email?: string;
  guardian_phone?: string;
  office_location?: string;
  office_hours?: string;
  bio?: string;
  specialization?: string;
}

@Injectable()
export class MembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mapper: MemberMapperService,
  ) {}

  async list(
    tenantId: string,
    query: { search?: string; role?: string; status?: string },
    actor: MemberActor,
  ): Promise<MemberView[]> {
    return this.mapper.listMembers(
      tenantId,
      {
        search: query.search,
        role: isLegacyRole(query.role) ? query.role : undefined,
        status: isLegacyStatus(query.status) ? query.status : undefined,
      },
      actor,
    );
  }

  async me(actor: MemberActor): Promise<MemberView> {
    const selfIds = await this.mapper.getSelfIds(actor.id, actor.tenantId);
    let memberId = selfIds.studentId ?? selfIds.staffId ?? selfIds.userId;

    // Guardians and parents do not have a Student row of their own. Open the
    // workspace on their first linked student so the portal and read-only
    // member views resolve to a real student record.
    if (!selfIds.studentId && !selfIds.staffId) {
      const guardian = await this.prisma.guardian.findFirst({
        where: { userId: actor.id, tenantId: actor.tenantId },
        select: {
          students: {
            select: { studentId: true },
            orderBy: { isPrimary: 'desc' },
            take: 1,
          },
        },
      });

      const linkedStudentId = guardian?.students[0]?.studentId;
      if (linkedStudentId) {
        memberId = linkedStudentId;
      }
    }

    return this.get(actor.tenantId, memberId, actor);
  }

  async get(
    tenantId: string,
    id: string,
    actor: MemberActor,
  ): Promise<MemberView> {
    const member = await this.mapper.getMember(tenantId, id, actor);

    if (!member) {
      throw new NotFoundException('Student or faculty profile not found.');
    }

    return member;
  }

  async create(input: MemberInput, actor: MemberActor): Promise<MemberView> {
    if (!input.name || !input.role) {
      throw new BadRequestException('Name and Role are required fields.');
    }

    const { firstName, lastName } = splitName(input.name);

    try {
      if (input.role === 'Student') {
        const admissionNumber = await this.generateNumber(
          'ADM',
          actor.tenantId,
          'student',
        );
        const dateOfBirth = toBirthDate(input.dob_month, input.dob_day);

        const student = await this.prisma.$transaction(async (tx) => {
          const created = await tx.student.create({
            data: {
              tenantId: actor.tenantId,
              admissionNumber,
              firstName,
              lastName,
              dateOfBirth,
              admissionDate: new Date(),
              status: 'ACTIVE',
              email: input.email?.trim().toLowerCase() || null,
              phone: input.phone?.trim() || null,
              address: input.address?.trim() || null,
              photoUrl: input.profile_picture_url?.trim() || null,
              unitId: input.unit_id || null,
            },
          });

          if (
            input.guardian_name ||
            input.guardian_email ||
            input.guardian_phone
          ) {
            const guardianName = splitName(input.guardian_name || 'Guardian');
            const guardian = await tx.guardian.create({
              data: {
                tenantId: actor.tenantId,
                firstName: guardianName.firstName,
                lastName: guardianName.lastName,
                email: input.guardian_email?.trim() || null,
                phone: input.guardian_phone?.trim() || '',
                address: input.address?.trim() || null,
              },
            });

            await tx.studentGuardian.create({
              data: {
                tenantId: actor.tenantId,
                studentId: created.id,
                guardianId: guardian.id,
                relationship: 'GUARDIAN',
                isPrimary: true,
              },
            });
          }

          return created;
        });

        return this.get(actor.tenantId, student.id, actor);
      }

      const employeeNumber = await this.generateNumber(
        'EMP',
        actor.tenantId,
        'staff',
      );
      const departmentId = input.unit_id
        ? await this.resolveDepartmentId(actor.tenantId, input.unit_id)
        : null;

      const staff = await this.prisma.staff.create({
        data: {
          tenantId: actor.tenantId,
          employeeNumber,
          firstName,
          lastName,
          email: input.email?.trim().toLowerCase() || null,
          phone: input.phone?.trim() || null,
          dateOfBirth: toBirthDate(input.dob_month, input.dob_day),
          hireDate: new Date(),
          employmentType: 'FULL_TIME',
          status: 'ACTIVE',
          jobTitle: input.position?.trim() || 'Faculty Staff',
          qualification: input.specialization?.trim() || null,
          address: input.address?.trim() || null,
          departmentId,
        },
      });

      return this.get(actor.tenantId, staff.id, actor);
    } catch (error) {
      this.rethrowUnique(error);
      throw error;
    }
  }

  async update(
    id: string,
    input: MemberInput,
    actor: MemberActor,
  ): Promise<MemberView> {
    const resolved = await this.mapper.resolveMember(actor.tenantId, id);
    if (!resolved) {
      throw new NotFoundException('Profile not found.');
    }

    const current = await this.mapper.getMemberRaw(actor.tenantId, id);
    if (!current) {
      throw new NotFoundException('Profile not found.');
    }

    const selfIds = await this.mapper.getSelfIds(actor.id, actor.tenantId);
    const isAdmin = ADMIN_ROLES.includes(actor.role);
    const isSelf =
      resolved.kind === 'STUDENT'
        ? selfIds.studentId === id
        : resolved.kind === 'STAFF'
          ? selfIds.staffId === id
          : selfIds.userId === id;

    if (!isAdmin && !isSelf) {
      throw new ForbiddenException(
        'Access Denied: Insufficient permissions to update this profile.',
      );
    }

    if (!isAdmin) {
      if (input.role !== undefined && input.role !== current.role) {
        throw new ForbiddenException(
          'Access Denied: You cannot modify roles.',
        );
      }
      if (input.position !== undefined && input.position !== current.position) {
        throw new ForbiddenException(
          'Access Denied: You cannot change academic positions.',
        );
      }
      if (
        input.unit_id !== undefined &&
        (input.unit_id || null) !== (current.unit_id || null)
      ) {
        throw new ForbiddenException(
          'Access Denied: You cannot change classes or faculties.',
        );
      }
      if (input.status !== undefined && input.status !== current.status) {
        throw new ForbiddenException(
          'Access Denied: You cannot modify enrollment status.',
        );
      }
    }

    const name = input.name ? splitName(input.name) : null;

    try {
      if (resolved.kind === 'STUDENT') {
        await this.prisma.student.update({
          where: { id },
          data: {
            ...(name ? { firstName: name.firstName, lastName: name.lastName } : {}),
            ...(input.email !== undefined
              ? { email: input.email.trim().toLowerCase() || null }
              : {}),
            ...(input.phone !== undefined
              ? { phone: input.phone.trim() || null }
              : {}),
            ...(input.address !== undefined
              ? { address: input.address.trim() || null }
              : {}),
            ...(input.profile_picture_url !== undefined
              ? { photoUrl: input.profile_picture_url.trim() || null }
              : {}),
            ...(input.dob_month !== undefined || input.dob_day !== undefined
              ? { dateOfBirth: toBirthDate(input.dob_month, input.dob_day) }
              : {}),
            ...(input.unit_id !== undefined
              ? { unitId: input.unit_id || null }
              : {}),
            ...(input.status !== undefined
              ? { status: input.status === 'Active' ? 'ACTIVE' : 'INACTIVE' }
              : {}),
          },
        });

        await this.updateGuardian(id, actor.tenantId, input);
      } else if (resolved.kind === 'STAFF') {
        const departmentId =
          input.unit_id !== undefined
            ? await this.resolveDepartmentId(
                actor.tenantId,
                input.unit_id || '',
              )
            : undefined;

        await this.prisma.staff.update({
          where: { id },
          data: {
            ...(name ? { firstName: name.firstName, lastName: name.lastName } : {}),
            ...(input.email !== undefined
              ? { email: input.email.trim().toLowerCase() || null }
              : {}),
            ...(input.phone !== undefined
              ? { phone: input.phone.trim() || null }
              : {}),
            ...(input.address !== undefined
              ? { address: input.address.trim() || null }
              : {}),
            ...(input.dob_month !== undefined || input.dob_day !== undefined
              ? { dateOfBirth: toBirthDate(input.dob_month, input.dob_day) }
              : {}),
            ...(input.position !== undefined
              ? { jobTitle: input.position.trim() || 'Faculty Staff' }
              : {}),
            ...(input.specialization !== undefined
              ? { qualification: input.specialization.trim() || null }
              : {}),
            ...(departmentId !== undefined ? { departmentId } : {}),
            ...(input.status !== undefined
              ? {
                  status:
                    input.status === 'Active' ? 'ACTIVE' : 'RESIGNED',
                }
              : {}),
          },
        });
      } else {
        await this.prisma.user.update({
          where: { id },
          data: {
            ...(name ? { firstName: name.firstName, lastName: name.lastName } : {}),
            ...(input.email !== undefined
              ? { email: input.email.trim().toLowerCase() }
              : {}),
            ...(input.phone !== undefined
              ? { phone: input.phone.trim() || null }
              : {}),
            ...(input.profile_picture_url !== undefined
              ? { avatarUrl: input.profile_picture_url.trim() || null }
              : {}),
            ...(input.status !== undefined
              ? { isActive: input.status === 'Active' }
              : {}),
          },
        });
      }
    } catch (error) {
      this.rethrowUnique(error);
      throw error;
    }

    return this.get(actor.tenantId, id, actor);
  }

  async remove(
    id: string,
    actor: MemberActor,
  ): Promise<{ success: true; message: string }> {
    const resolved = await this.mapper.resolveMember(actor.tenantId, id);
    if (!resolved) {
      throw new NotFoundException('Profile not found.');
    }

    const selfIds = await this.mapper.getSelfIds(actor.id, actor.tenantId);
    const isSelf =
      resolved.kind === 'STUDENT'
        ? selfIds.studentId === id
        : resolved.kind === 'STAFF'
          ? selfIds.staffId === id
          : selfIds.userId === id;

    if (isSelf) {
      throw new ForbiddenException(
        'You cannot archive your own account. Ask another administrator to do it.',
      );
    }

    if (resolved.kind === 'USER') {
      const activeAdmins = await this.prisma.user.count({
        where: {
          tenantId: actor.tenantId,
          isActive: true,
          role: { in: ADMIN_ROLES },
        },
      });

      if (activeAdmins <= 1) {
        throw new ForbiddenException(
          'The last active administrator cannot be archived. Create another administrator first.',
        );
      }
    }

    if (resolved.kind === 'STUDENT') {
      await this.prisma.student.update({
        where: { id },
        data: { status: 'INACTIVE' },
      });
    } else if (resolved.kind === 'STAFF') {
      await this.prisma.staff.update({
        where: { id },
        data: { status: 'RESIGNED' },
      });
    } else {
      await this.prisma.user.update({
        where: { id },
        data: { isActive: false },
      });
    }

    return {
      success: true,
      message: 'Profile archived successfully. Historical records are retained.',
    };
  }

  private async updateGuardian(
    studentId: string,
    tenantId: string,
    input: MemberInput,
  ): Promise<void> {
    if (
      input.guardian_name === undefined &&
      input.guardian_email === undefined &&
      input.guardian_phone === undefined
    ) {
      return;
    }

    const link = await this.prisma.studentGuardian.findFirst({
      where: { tenantId, studentId },
      orderBy: { isPrimary: 'desc' },
      include: { guardian: true },
    });

    const guardianName = splitName(input.guardian_name || 'Guardian');

    if (!link) {
      if (!input.guardian_name && !input.guardian_email && !input.guardian_phone) {
        return;
      }

      const guardian = await this.prisma.guardian.create({
        data: {
          tenantId,
          firstName: guardianName.firstName,
          lastName: guardianName.lastName,
          email: input.guardian_email?.trim() || null,
          phone: input.guardian_phone?.trim() || '',
        },
      });

      await this.prisma.studentGuardian.create({
        data: {
          tenantId,
          studentId,
          guardianId: guardian.id,
          relationship: 'GUARDIAN',
          isPrimary: true,
        },
      });
      return;
    }

    await this.prisma.guardian.update({
      where: { id: link.guardianId },
      data: {
        ...(input.guardian_name !== undefined
          ? {
              firstName: guardianName.firstName,
              lastName: guardianName.lastName,
            }
          : {}),
        ...(input.guardian_email !== undefined
          ? { email: input.guardian_email.trim() || null }
          : {}),
        ...(input.guardian_phone !== undefined
          ? { phone: input.guardian_phone.trim() || '' }
          : {}),
      },
    });
  }

  private async resolveDepartmentId(
    tenantId: string,
    unitId: string,
  ): Promise<string | null> {
    if (!unitId) {
      return null;
    }

    const department = await this.prisma.department.findFirst({
      where: { id: unitId, tenantId },
      select: { id: true },
    });

    return department?.id ?? null;
  }

  private async generateNumber(
    prefix: 'ADM' | 'EMP',
    tenantId: string,
    kind: 'student' | 'staff',
  ): Promise<string> {
    const year = new Date().getFullYear();

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const candidate = `${prefix}-${year}-${randomInt(100000, 1000000)}`;
      const exists =
        kind === 'student'
          ? await this.prisma.student.findFirst({
              where: { tenantId, admissionNumber: candidate },
              select: { id: true },
            })
          : await this.prisma.staff.findFirst({
              where: { tenantId, employeeNumber: candidate },
              select: { id: true },
            });

      if (!exists) {
        return candidate;
      }
    }

    throw new ConflictException('Could not allocate a unique record number.');
  }

  private rethrowUnique(error: unknown): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(
        'A record with this email or number already exists.',
      );
    }
  }
}

function splitName(name: string): { firstName: string; lastName: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? 'Unnamed',
    lastName: parts.slice(1).join(' '),
  };
}

function toBirthDate(
  month?: number,
  day?: number,
): Date | null {
  if (!month || !day) {
    return null;
  }

  const date = new Date(Date.UTC(2000, month - 1, day));
  return Number.isNaN(date.getTime()) ? null : date;
}

function isLegacyRole(value?: string): value is LegacyRole {
  return (
    value === 'Principal' ||
    value === 'Teacher' ||
    value === 'Counselor' ||
    value === 'Student'
  );
}

function isLegacyStatus(value?: string): value is LegacyMemberStatus {
  return value === 'Active' || value === 'Inactive';
}
