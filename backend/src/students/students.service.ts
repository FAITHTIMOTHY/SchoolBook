import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  EnrollmentStatus,
  Prisma,
  StudentStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  CreateStudentInput,
  LinkGuardianInput,
  ListStudentsQuery,
  PaginatedStudents,
  StudentActorContext,
  StudentGuardianLink,
  StudentProfile,
  StudentSummary,
  UpdateStudentInput,
} from './students.types.js';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

const studentSummarySelect = {
  id: true,
  tenantId: true,
  admissionNumber: true,
  firstName: true,
  lastName: true,
  otherNames: true,
  gender: true,
  dateOfBirth: true,
  admissionDate: true,
  status: true,
  email: true,
  phone: true,
  photoUrl: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.StudentSelect;

const guardianLinkSelect = {
  id: true,
  relationship: true,
  isPrimary: true,
  createdAt: true,
  guardian: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      occupation: true,
      address: true,
    },
  },
} satisfies Prisma.StudentGuardianSelect;

const studentProfileSelect = {
  ...studentSummarySelect,
  address: true,
  bloodGroup: true,
  allergies: true,
  notes: true,
  user: {
    select: {
      id: true,
      email: true,
      role: true,
      isActive: true,
    },
  },
  guardians: {
    orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    select: guardianLinkSelect,
  },
  enrollments: {
    where: { status: EnrollmentStatus.ACTIVE },
    orderBy: { enrollmentDate: 'desc' },
    take: 1,
    select: {
      id: true,
      status: true,
      enrollmentDate: true,
      classroom: {
        select: {
          id: true,
          name: true,
          code: true,
          gradeLevel: true,
          section: true,
        },
      },
      academicYear: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },
} satisfies Prisma.StudentSelect;

type StudentSummaryRecord = Prisma.StudentGetPayload<{
  select: typeof studentSummarySelect;
}>;

type StudentProfileRecord = Prisma.StudentGetPayload<{
  select: typeof studentProfileSelect;
}>;

type EnrollmentSummaryRecord = StudentProfileRecord['enrollments'][number];

type GuardianLinkRecord = Prisma.StudentGuardianGetPayload<{
  select: typeof guardianLinkSelect;
}>;

@Injectable()
export class StudentsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * tenantId always comes from the verified JWT via the controller. Every
   * query below is explicitly scoped by it.
   */
  async list(
    tenantId: string,
    query: ListStudentsQuery,
  ): Promise<PaginatedStudents> {
    this.assertTenantContext(tenantId);

    const page = Math.max(1, Math.trunc(query.page ?? 1));
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, Math.trunc(query.pageSize ?? DEFAULT_PAGE_SIZE)),
    );

    const where = this.buildListWhere(tenantId, query);
    const orderBy: Prisma.StudentOrderByWithRelationInput = {
      [query.sortBy ?? 'createdAt']: query.sortOrder ?? 'desc',
    };

    const [records, total] = await this.prisma.$transaction([
      this.prisma.student.findMany({
        where,
        select: studentSummarySelect,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.student.count({ where }),
    ]);

    return {
      data: records.map((record) => this.toStudentSummary(record)),
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  }

  async getById(tenantId: string, studentId: string): Promise<StudentProfile> {
    this.assertTenantContext(tenantId);

    const student = await this.prisma.student.findFirst({
      where: { id: studentId, tenantId },
      select: studentProfileSelect,
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    return this.toStudentProfile(student);
  }

  async getMe(tenantId: string, userId: string): Promise<StudentProfile> {
    this.assertTenantContext(tenantId);

    const student = await this.prisma.student.findFirst({
      where: { userId, tenantId },
      select: studentProfileSelect,
    });

    if (!student) {
      throw new NotFoundException('Student profile not found');
    }

    return this.toStudentProfile(student);
  }

  async create(
    actor: StudentActorContext,
    input: CreateStudentInput,
  ): Promise<StudentProfile> {
    this.assertTenantContext(actor.tenantId);
    await this.assertActiveTenant(actor.tenantId);

    const admissionNumber = input.admissionNumber.trim();
    await this.assertAdmissionNumberAvailable(actor.tenantId, admissionNumber);

    if (input.userId) {
      await this.assertUserLinkable(actor.tenantId, input.userId);
    }

    try {
      const student = await this.prisma.student.create({
        data: {
          tenantId: actor.tenantId,
          admissionNumber,
          firstName: input.firstName.trim(),
          lastName: input.lastName.trim(),
          otherNames: this.normalizeNullableString(input.otherNames),
          gender: input.gender ?? null,
          dateOfBirth: this.toNullableDate(input.dateOfBirth),
          admissionDate: this.toDate(input.admissionDate),
          status: input.status ?? StudentStatus.ACTIVE,
          email: this.normalizeNullableEmail(input.email),
          phone: this.normalizeNullableString(input.phone),
          address: this.normalizeNullableString(input.address),
          photoUrl: this.normalizeNullableString(input.photoUrl),
          bloodGroup: this.normalizeNullableString(input.bloodGroup),
          allergies: this.normalizeNullableString(input.allergies),
          notes: this.normalizeNullableString(input.notes),
          userId: input.userId ?? null,
        },
        select: studentProfileSelect,
      });

      return this.toStudentProfile(student);
    } catch (error) {
      this.rethrowStudentWriteError(error);
    }
  }

  async update(
    actor: StudentActorContext,
    studentId: string,
    input: UpdateStudentInput,
  ): Promise<StudentProfile> {
    this.assertTenantContext(actor.tenantId);
    await this.assertActiveTenant(actor.tenantId);

    const existing = await this.prisma.student.findFirst({
      where: { id: studentId, tenantId: actor.tenantId },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException('Student not found');
    }

    const data: Prisma.StudentUncheckedUpdateInput = {};

    if (input.admissionNumber !== undefined) {
      const admissionNumber = input.admissionNumber.trim();
      await this.assertAdmissionNumberAvailable(
        actor.tenantId,
        admissionNumber,
        studentId,
      );
      data.admissionNumber = admissionNumber;
    }

    if (input.firstName !== undefined) {
      data.firstName = input.firstName.trim();
    }

    if (input.lastName !== undefined) {
      data.lastName = input.lastName.trim();
    }

    if (input.otherNames !== undefined) {
      data.otherNames = this.normalizeNullableString(input.otherNames);
    }

    if (input.gender !== undefined) {
      data.gender = input.gender ?? null;
    }

    if (input.dateOfBirth !== undefined) {
      data.dateOfBirth = this.toNullableDate(input.dateOfBirth);
    }

    if (input.admissionDate !== undefined) {
      data.admissionDate = this.toDate(input.admissionDate);
    }

    if (input.status !== undefined) {
      data.status = input.status;
    }

    if (input.email !== undefined) {
      data.email = this.normalizeNullableEmail(input.email);
    }

    if (input.phone !== undefined) {
      data.phone = this.normalizeNullableString(input.phone);
    }

    if (input.address !== undefined) {
      data.address = this.normalizeNullableString(input.address);
    }

    if (input.photoUrl !== undefined) {
      data.photoUrl = this.normalizeNullableString(input.photoUrl);
    }

    if (input.bloodGroup !== undefined) {
      data.bloodGroup = this.normalizeNullableString(input.bloodGroup);
    }

    if (input.allergies !== undefined) {
      data.allergies = this.normalizeNullableString(input.allergies);
    }

    if (input.notes !== undefined) {
      data.notes = this.normalizeNullableString(input.notes);
    }

    if (input.userId !== undefined) {
      if (input.userId) {
        await this.assertUserLinkable(
          actor.tenantId,
          input.userId,
          studentId,
        );
      }

      data.userId = input.userId ?? null;
    }

    try {
      const student = await this.prisma.student.update({
        where: { id: studentId, tenantId: actor.tenantId },
        data,
        select: studentProfileSelect,
      });

      return this.toStudentProfile(student);
    } catch (error) {
      this.rethrowStudentWriteError(error);
    }
  }

  /**
   * Soft-withdraws the student. Hard deletes are avoided because the student
   * owns attendance, results, invoices, and discipline history.
   */
  async remove(
    actor: StudentActorContext,
    studentId: string,
  ): Promise<StudentProfile> {
    this.assertTenantContext(actor.tenantId);
    await this.assertActiveTenant(actor.tenantId);

    const existing = await this.prisma.student.findFirst({
      where: { id: studentId, tenantId: actor.tenantId },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException('Student not found');
    }

    const student = await this.prisma.student.update({
      where: { id: studentId, tenantId: actor.tenantId },
      data: { status: StudentStatus.WITHDRAWN },
      select: studentProfileSelect,
    });

    return this.toStudentProfile(student);
  }

  async getGuardians(
    tenantId: string,
    studentId: string,
  ): Promise<StudentGuardianLink[]> {
    this.assertTenantContext(tenantId);
    await this.assertStudentExists(tenantId, studentId);

    const links = await this.prisma.studentGuardian.findMany({
      where: { tenantId, studentId },
      select: guardianLinkSelect,
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    });

    return links.map((link) => this.toGuardianLink(link));
  }

  async linkGuardian(
    actor: StudentActorContext,
    studentId: string,
    input: LinkGuardianInput,
  ): Promise<StudentGuardianLink> {
    this.assertTenantContext(actor.tenantId);
    await this.assertActiveTenant(actor.tenantId);

    const [student, guardian, existingLink] = await Promise.all([
      this.prisma.student.findFirst({
        where: { id: studentId, tenantId: actor.tenantId },
        select: { id: true },
      }),
      this.prisma.guardian.findFirst({
        where: { id: input.guardianId, tenantId: actor.tenantId },
        select: { id: true },
      }),
      this.prisma.studentGuardian.findFirst({
        where: {
          tenantId: actor.tenantId,
          studentId,
          guardianId: input.guardianId,
        },
        select: { id: true },
      }),
    ]);

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    if (!guardian) {
      throw new NotFoundException('Guardian not found');
    }

    if (existingLink) {
      throw new ConflictException(
        'Guardian is already linked to this student',
      );
    }

    const isPrimary = input.isPrimary ?? false;

    try {
      return await this.prisma.$transaction(async (tx) => {
        if (isPrimary) {
          await tx.studentGuardian.updateMany({
            where: { tenantId: actor.tenantId, studentId },
            data: { isPrimary: false },
          });
        }

        const link = await tx.studentGuardian.create({
          data: {
            tenantId: actor.tenantId,
            studentId,
            guardianId: input.guardianId,
            relationship: input.relationship,
            isPrimary,
          },
          select: guardianLinkSelect,
        });

        return this.toGuardianLink(link);
      });
    } catch (error) {
      this.rethrowStudentWriteError(error);
    }
  }

  async unlinkGuardian(
    actor: StudentActorContext,
    studentId: string,
    guardianId: string,
  ): Promise<void> {
    this.assertTenantContext(actor.tenantId);
    await this.assertActiveTenant(actor.tenantId);

    const result = await this.prisma.studentGuardian.deleteMany({
      where: {
        tenantId: actor.tenantId,
        studentId,
        guardianId,
      },
    });

    if (result.count === 0) {
      throw new NotFoundException('Guardian link not found');
    }
  }

  private buildListWhere(
    tenantId: string,
    query: ListStudentsQuery,
  ): Prisma.StudentWhereInput {
    const where: Prisma.StudentWhereInput = { tenantId };

    if (query.status) {
      where.status = query.status;
    }

    if (query.gender) {
      where.gender = query.gender;
    }

    if (query.classroomId || query.academicYearId) {
      where.enrollments = {
        some: {
          tenantId,
          ...(query.classroomId ? { classroomId: query.classroomId } : {}),
          ...(query.academicYearId
            ? { academicYearId: query.academicYearId }
            : {}),
        },
      };
    }

    if (query.search) {
      const search = query.search.trim();

      if (search) {
        where.OR = [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { admissionNumber: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ];
      }
    }

    return where;
  }

  private async assertStudentExists(
    tenantId: string,
    studentId: string,
  ): Promise<void> {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, tenantId },
      select: { id: true },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }
  }

  private async assertAdmissionNumberAvailable(
    tenantId: string,
    admissionNumber: string,
    excludeStudentId?: string,
  ): Promise<void> {
    const existing = await this.prisma.student.findFirst({
      where: {
        tenantId,
        admissionNumber,
        ...(excludeStudentId
          ? { NOT: { id: excludeStudentId } }
          : {}),
      },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException(
        'A student with this admission number already exists',
      );
    }
  }

  private async assertUserLinkable(
    tenantId: string,
    userId: string,
    currentStudentId?: string,
  ): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId, isActive: true },
      select: {
        id: true,
        student: { select: { id: true } },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.student && user.student.id !== currentStudentId) {
      throw new ConflictException(
        'User is already linked to another student',
      );
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

  private toNullableDate(value?: string | null): Date | null {
    return value ? this.toDate(value) : null;
  }

  private normalizeNullableEmail(value?: string | null): string | null {
    const normalized = this.normalizeNullableString(value);
    return normalized ? normalized.toLowerCase() : null;
  }

  private normalizeNullableString(value?: string | null): string | null {
    if (value === undefined || value === null) {
      return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private rethrowStudentWriteError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        throw new ConflictException(
          'A student with this admission number or a conflicting user link already exists',
        );
      }

      if (error.code === 'P2025') {
        throw new NotFoundException(
          'Student, guardian, or linked user not found',
        );
      }

      if (error.code === 'P2003') {
        throw new ConflictException('Related record does not exist');
      }
    }

    throw error;
  }

  private toStudentSummary(record: StudentSummaryRecord): StudentSummary {
    return {
      id: record.id,
      tenantId: record.tenantId,
      admissionNumber: record.admissionNumber,
      firstName: record.firstName,
      lastName: record.lastName,
      otherNames: record.otherNames,
      gender: record.gender,
      dateOfBirth: this.toDateOnly(record.dateOfBirth),
      admissionDate: this.toDateOnly(record.admissionDate) as string,
      status: record.status,
      email: record.email,
      phone: record.phone,
      photoUrl: record.photoUrl,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  private toStudentProfile(record: StudentProfileRecord): StudentProfile {
    return {
      ...this.toStudentSummary(record),
      address: record.address,
      bloodGroup: record.bloodGroup,
      allergies: record.allergies,
      notes: record.notes,
      user: record.user,
      guardians: record.guardians.map((link) => this.toGuardianLink(link)),
      currentEnrollment: record.enrollments[0]
        ? this.toEnrollment(record.enrollments[0])
        : null,
    };
  }

  private toGuardianLink(record: GuardianLinkRecord): StudentGuardianLink {
    return {
      id: record.id,
      relationship: record.relationship,
      isPrimary: record.isPrimary,
      createdAt: record.createdAt.toISOString(),
      guardian: {
        id: record.guardian.id,
        firstName: record.guardian.firstName,
        lastName: record.guardian.lastName,
        email: record.guardian.email,
        phone: record.guardian.phone,
        occupation: record.guardian.occupation,
        address: record.guardian.address,
      },
    };
  }

  private toEnrollment(
    record: EnrollmentSummaryRecord,
  ): NonNullable<StudentProfile['currentEnrollment']> {
    return {
      id: record.id,
      status: record.status,
      enrollmentDate: this.toDateOnly(record.enrollmentDate) as string,
      classroom: {
        id: record.classroom.id,
        name: record.classroom.name,
        code: record.classroom.code,
        gradeLevel: record.classroom.gradeLevel,
        section: record.classroom.section,
      },
      academicYear: {
        id: record.academicYear.id,
        name: record.academicYear.name,
      },
    };
  }

  private toDateOnly(value: Date | null): string | null {
    return value ? value.toISOString().slice(0, 10) : null;
  }
}
