import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { ADMIN_ROLES } from './compat.types.js';
import type {
  LegacyCourseGrade,
  LegacyStudentPortal,
  MemberActor,
} from './compat.types.js';
import { MemberMapperService, toLegacyRole } from './member-mapper.service.js';

export interface PortalUpdateInput {
  overall_score?: number;
  term?: string;
  grades?: unknown[];
  teacher_remarks?: string;
  guardian_name?: string;
  guardian_email?: string;
  guardian_phone?: string;
  guardian_relation?: string;
  syllabus_attachments?: unknown[];
}

const STAFF_VIEW_ROLES = [...ADMIN_ROLES, 'TEACHER', 'LIBRARIAN'];
const PORTAL_EDIT_ROLES = [...ADMIN_ROLES, 'TEACHER'];

@Injectable()
export class PortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mapper: MemberMapperService,
  ) {}

  async list(
    tenantId: string,
    actor: MemberActor,
  ): Promise<LegacyStudentPortal[]> {
    const portals = await this.prisma.studentPortal.findMany({
      where: { tenantId },
      orderBy: { updatedAt: 'desc' },
      take: 1000,
      include: {
        student: {
          select: {
            firstName: true,
            lastName: true,
            enrollments: {
              where: { status: 'ACTIVE' },
              include: { classroom: true },
              orderBy: { enrollmentDate: 'desc' },
              take: 1,
            },
          },
        },
        lastUpdatedBy: {
          select: { firstName: true, lastName: true, role: true },
        },
      },
    });

    const allowedStudentIds = await this.allowedStudentIds(tenantId, actor);
    const visible =
      allowedStudentIds === null
        ? portals
        : portals.filter((portal) =>
            allowedStudentIds.includes(portal.studentId),
          );

    return visible.map((portal) => this.mapPortal(portal));
  }

  async get(
    tenantId: string,
    studentId: string,
    actor: MemberActor,
  ): Promise<LegacyStudentPortal> {
    await this.assertCanView(tenantId, studentId, actor);

    const student = await this.prisma.student.findFirst({
      where: { id: studentId, tenantId },
      include: {
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
        portal: {
          include: {
            lastUpdatedBy: {
              select: { firstName: true, lastName: true, role: true },
            },
          },
        },
      },
    });

    if (!student) {
      throw new NotFoundException('Student profile not found.');
    }

    if (student.portal) {
      return this.mapPortal({ ...student.portal, student });
    }

    const term = await this.currentTermName(tenantId);
    const guardianLink = student.guardians[0];
    const guardian = guardianLink?.guardian;
    const classroom = student.enrollments[0]?.classroom;

    const created = await this.prisma.studentPortal.create({
      data: {
        tenantId,
        studentId,
        gradeLevel: classroom?.name ?? 'Student',
        overallScore: 0,
        term,
        grades: [],
        teacherRemarks: 'No evaluation recorded yet.',
        guardianName: guardian
          ? `${guardian.firstName} ${guardian.lastName}`.trim()
          : '',
        guardianEmail: guardian?.email ?? '',
        guardianPhone: guardian?.phone ?? '',
        guardianRelation: guardianLink
          ? relationshipLabel(guardianLink.relationship)
          : 'Parent/Guardian',
        syllabusAttachments: [],
      },
      include: {
        lastUpdatedBy: {
          select: { firstName: true, lastName: true, role: true },
        },
      },
    });

    return this.mapPortal({ ...created, student });
  }

  async update(
    tenantId: string,
    studentId: string,
    input: PortalUpdateInput,
    actor: MemberActor,
  ): Promise<{ message: string; portal: LegacyStudentPortal }> {
    if (!PORTAL_EDIT_ROLES.includes(actor.role)) {
      throw new ForbiddenException(
        'Access Denied: Only teachers and management can edit student portals.',
      );
    }

    const student = await this.prisma.student.findFirst({
      where: { id: studentId, tenantId },
      include: {
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
        portal: true,
      },
    });

    if (!student) {
      throw new NotFoundException('Student profile not found.');
    }

    const overallScore =
      input.overall_score !== undefined
        ? clampScore(input.overall_score)
        : undefined;
    const classroom = student.enrollments[0]?.classroom;

    const data = {
      ...(overallScore !== undefined ? { overallScore } : {}),
      ...(input.term !== undefined
        ? { term: input.term.trim() || 'Current Term' }
        : {}),
      ...(input.grades !== undefined
        ? { grades: input.grades as Prisma.InputJsonValue }
        : {}),
      ...(input.teacher_remarks !== undefined
        ? { teacherRemarks: input.teacher_remarks.trim() }
        : {}),
      ...(input.guardian_name !== undefined
        ? { guardianName: input.guardian_name.trim() }
        : {}),
      ...(input.guardian_email !== undefined
        ? { guardianEmail: input.guardian_email.trim() }
        : {}),
      ...(input.guardian_phone !== undefined
        ? { guardianPhone: input.guardian_phone.trim() }
        : {}),
      ...(input.guardian_relation !== undefined
        ? { guardianRelation: input.guardian_relation.trim() }
        : {}),
      ...(input.syllabus_attachments !== undefined
        ? {
            syllabusAttachments:
              input.syllabus_attachments as Prisma.InputJsonValue,
          }
        : {}),
      lastUpdatedById: actor.id,
    };

    let portal;

    if (student.portal) {
      portal = await this.prisma.studentPortal.update({
        where: { id: student.portal.id },
        data: {
          ...data,
          ...(classroom ? { gradeLevel: classroom.name } : {}),
        },
        include: {
          lastUpdatedBy: {
            select: { firstName: true, lastName: true, role: true },
          },
        },
      });
    } else {
      const term = await this.currentTermName(tenantId);
      portal = await this.prisma.studentPortal.create({
        data: {
          tenantId,
          studentId,
          gradeLevel: classroom?.name ?? 'Student',
          overallScore: overallScore ?? 0,
          term: input.term?.trim() || term,
          grades: (input.grades ?? []) as Prisma.InputJsonValue,
          teacherRemarks: input.teacher_remarks?.trim() ?? '',
          guardianName: input.guardian_name?.trim() ?? '',
          guardianEmail: input.guardian_email?.trim() ?? '',
          guardianPhone: input.guardian_phone?.trim() ?? '',
          guardianRelation:
            input.guardian_relation?.trim() ?? 'Parent/Guardian',
          syllabusAttachments: (input.syllabus_attachments ??
            []) as Prisma.InputJsonValue,
          lastUpdatedById: actor.id,
        },
        include: {
          lastUpdatedBy: {
            select: { firstName: true, lastName: true, role: true },
          },
        },
      });
    }

    return {
      message: 'Student portal updated successfully.',
      portal: this.mapPortal({ ...portal, student }),
    };
  }

  private async assertCanView(
    tenantId: string,
    studentId: string,
    actor: MemberActor,
  ): Promise<void> {
    const allowed = await this.allowedStudentIds(tenantId, actor);

    if (allowed === null) {
      return;
    }

    if (!allowed.includes(studentId)) {
      throw new ForbiddenException(
        'Access Denied: You can only view your own student portal.',
      );
    }
  }

  private async allowedStudentIds(
    tenantId: string,
    actor: MemberActor,
  ): Promise<string[] | null> {
    if (STAFF_VIEW_ROLES.includes(actor.role)) {
      return null;
    }

    if (actor.role === 'STUDENT') {
      const self = await this.mapper.getSelfIds(actor.id, tenantId);
      return self.studentId ? [self.studentId] : [];
    }

    if (actor.role === 'PARENT' || actor.role === 'GUARDIAN') {
      const guardian = await this.prisma.guardian.findFirst({
        where: { userId: actor.id, tenantId },
        select: {
          students: { select: { studentId: true } },
        },
      });

      return guardian?.students.map((link) => link.studentId) ?? [];
    }

    return [];
  }

  private async currentTermName(tenantId: string): Promise<string> {
    const term = await this.prisma.term.findFirst({
      where: { tenantId, isCurrent: true },
      select: { name: true },
    });

    return term?.name ?? 'Current Term';
  }

  private mapPortal(portal: any): LegacyStudentPortal {
    const student = portal.student;
    const classroom = student?.enrollments?.[0]?.classroom;

    return {
      id: portal.id,
      tenant_id: portal.tenantId,
      student_id: portal.studentId,
      student_name: student
        ? [student.firstName, student.lastName]
            .filter(Boolean)
            .join(' ')
            .trim()
        : '',
      grade_level: portal.gradeLevel || classroom?.name || 'Student',
      overall_score: portal.overallScore,
      term: portal.term,
      grades: Array.isArray(portal.grades)
        ? (portal.grades as LegacyCourseGrade[])
        : [],
      teacher_remarks: portal.teacherRemarks,
      guardian_name: portal.guardianName,
      guardian_email: portal.guardianEmail,
      guardian_phone: portal.guardianPhone,
      guardian_relation: portal.guardianRelation,
      syllabus_attachments: Array.isArray(portal.syllabusAttachments)
        ? (portal.syllabusAttachments as LegacyStudentPortal['syllabus_attachments'])
        : [],
      last_updated_by: portal.lastUpdatedBy
        ? `${portal.lastUpdatedBy.firstName} ${portal.lastUpdatedBy.lastName} (${toLegacyRole(portal.lastUpdatedBy.role, null)})`
        : 'System',
      updated_at: new Date(portal.updatedAt).toISOString(),
    };
  }
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round(value)));
}

function relationshipLabel(relationship: string): string {
  const labels: Record<string, string> = {
    FATHER: 'Father',
    MOTHER: 'Mother',
    GUARDIAN: 'Guardian',
    SIBLING: 'Sibling',
    OTHER: 'Other',
  };

  return labels[relationship] ?? 'Parent/Guardian';
}
