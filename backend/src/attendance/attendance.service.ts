import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  AttendanceSessionStatus,
  AttendanceStatus,
  EnrollmentStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  AttendanceActorContext,
  AttendanceRecordSummary,
  AttendanceRosterEntry,
  AttendanceSessionDetail,
  AttendanceSessionSummary,
  AttendanceSummary,
  CreateAttendanceSessionInput,
  ListAttendanceSessionsQuery,
  PaginatedAttendanceSessions,
  SaveAttendanceRecordsInput,
  UpdateAttendanceRecordInput,
  UpdateAttendanceSessionInput,
} from './attendance.types.js';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const DEFAULT_PERIOD = 'FULL_DAY';

const sessionSummarySelect = {
  id: true,
  tenantId: true,
  classroomId: true,
  termId: true,
  subjectId: true,
  period: true,
  date: true,
  status: true,
  takenById: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  classroom: {
    select: {
      id: true,
      name: true,
      code: true,
    },
  },
  term: {
    select: {
      id: true,
      name: true,
      academicYearId: true,
    },
  },
  subject: {
    select: {
      id: true,
      name: true,
      code: true,
    },
  },
  takenBy: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
    },
  },
  _count: {
    select: {
      records: true,
    },
  },
} satisfies Prisma.AttendanceSessionSelect;

const attendanceRecordSelect = {
  id: true,
  sessionId: true,
  studentId: true,
  status: true,
  remarks: true,
  createdAt: true,
  updatedAt: true,
  student: {
    select: {
      id: true,
      admissionNumber: true,
      firstName: true,
      lastName: true,
    },
  },
} satisfies Prisma.AttendanceRecordSelect;

const sessionDetailSelect = {
  ...sessionSummarySelect,
  records: {
    orderBy: [
      { student: { lastName: 'asc' } },
      { student: { firstName: 'asc' } },
    ],
    select: attendanceRecordSelect,
  },
} satisfies Prisma.AttendanceSessionSelect;

type SessionSummaryRecord = Prisma.AttendanceSessionGetPayload<{
  select: typeof sessionSummarySelect;
}>;

type SessionDetailRecord = Prisma.AttendanceSessionGetPayload<{
  select: typeof sessionDetailSelect;
}>;

type RecordSummaryRecord = Prisma.AttendanceRecordGetPayload<{
  select: typeof attendanceRecordSelect;
}>;

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * tenantId is always supplied by the controller from the verified JWT.
   */
  async listSessions(
    tenantId: string,
    query: ListAttendanceSessionsQuery,
  ): Promise<PaginatedAttendanceSessions> {
    this.assertTenantContext(tenantId);

    const page = Math.max(1, Math.trunc(query.page ?? 1));
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, Math.trunc(query.pageSize ?? DEFAULT_PAGE_SIZE)),
    );

    const where = this.buildSessionWhere(tenantId, query);
    const orderBy: Prisma.AttendanceSessionOrderByWithRelationInput = {
      [query.sortBy ?? 'date']: query.sortOrder ?? 'desc',
    };

    const [records, total] = await this.prisma.$transaction([
      this.prisma.attendanceSession.findMany({
        where,
        select: sessionSummarySelect,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.attendanceSession.count({ where }),
    ]);

    return {
      data: records.map((record) => this.toSessionSummary(record)),
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  }

  async getSession(
    tenantId: string,
    sessionId: string,
  ): Promise<AttendanceSessionDetail> {
    this.assertTenantContext(tenantId);

    const session = await this.prisma.attendanceSession.findFirst({
      where: { id: sessionId, tenantId },
      select: sessionDetailSelect,
    });

    if (!session) {
      throw new NotFoundException('Attendance session not found');
    }

    return this.toSessionDetail(session);
  }

  async createSession(
    actor: AttendanceActorContext,
    input: CreateAttendanceSessionInput,
  ): Promise<AttendanceSessionDetail> {
    this.assertTenantContext(actor.tenantId);
    await this.assertActiveTenant(actor.tenantId);

    await Promise.all([
      this.assertClassroomInTenant(actor.tenantId, input.classroomId),
      this.assertTermInTenant(actor.tenantId, input.termId),
      input.subjectId
        ? this.assertSubjectInTenant(actor.tenantId, input.subjectId)
        : Promise.resolve(),
    ]);

    const takenById = await this.resolveTakenById(
      actor,
      input.takenById,
    );

    try {
      const session = await this.prisma.attendanceSession.create({
        data: {
          tenantId: actor.tenantId,
          classroomId: input.classroomId,
          termId: input.termId,
          subjectId: input.subjectId ?? null,
          period: input.period?.trim() || DEFAULT_PERIOD,
          date: this.toDate(input.date),
          takenById,
          notes: this.normalizeNullableString(input.notes),
        },
        select: sessionDetailSelect,
      });

      return this.toSessionDetail(session);
    } catch (error) {
      this.rethrowSessionWriteError(error);
    }
  }

  async updateSession(
    actor: AttendanceActorContext,
    sessionId: string,
    input: UpdateAttendanceSessionInput,
  ): Promise<AttendanceSessionDetail> {
    this.assertTenantContext(actor.tenantId);
    await this.assertActiveTenant(actor.tenantId);

    const existing = await this.prisma.attendanceSession.findFirst({
      where: { id: sessionId, tenantId: actor.tenantId },
      select: { id: true, status: true },
    });

    if (!existing) {
      throw new NotFoundException('Attendance session not found');
    }

    if (existing.status !== AttendanceSessionStatus.DRAFT) {
      throw new ConflictException('Only draft sessions can be edited');
    }

    const data: Prisma.AttendanceSessionUncheckedUpdateInput = {};

    if (input.classroomId !== undefined) {
      await this.assertClassroomInTenant(
        actor.tenantId,
        input.classroomId,
      );
      data.classroomId = input.classroomId;
    }

    if (input.termId !== undefined) {
      await this.assertTermInTenant(actor.tenantId, input.termId);
      data.termId = input.termId;
    }

    if (input.subjectId !== undefined) {
      if (input.subjectId) {
        await this.assertSubjectInTenant(actor.tenantId, input.subjectId);
      }

      data.subjectId = input.subjectId ?? null;
    }

    if (input.period !== undefined) {
      data.period = input.period.trim() || DEFAULT_PERIOD;
    }

    if (input.date !== undefined) {
      data.date = this.toDate(input.date);
    }

    if (input.takenById !== undefined) {
      data.takenById = await this.resolveTakenById(actor, input.takenById);
    }

    if (input.notes !== undefined) {
      data.notes = this.normalizeNullableString(input.notes);
    }

    try {
      const session = await this.prisma.attendanceSession.update({
        where: { id: sessionId, tenantId: actor.tenantId },
        data,
        select: sessionDetailSelect,
      });

      return this.toSessionDetail(session);
    } catch (error) {
      this.rethrowSessionWriteError(error);
    }
  }

  async deleteSession(
    actor: AttendanceActorContext,
    sessionId: string,
  ): Promise<void> {
    this.assertTenantContext(actor.tenantId);
    await this.assertActiveTenant(actor.tenantId);

    const existing = await this.prisma.attendanceSession.findFirst({
      where: { id: sessionId, tenantId: actor.tenantId },
      select: { id: true, status: true },
    });

    if (!existing) {
      throw new NotFoundException('Attendance session not found');
    }

    if (existing.status !== AttendanceSessionStatus.DRAFT) {
      throw new ConflictException('Only draft sessions can be deleted');
    }

    await this.prisma.attendanceSession.delete({
      where: { id: sessionId, tenantId: actor.tenantId },
    });
  }

  async submitSession(
    actor: AttendanceActorContext,
    sessionId: string,
  ): Promise<AttendanceSessionDetail> {
    this.assertTenantContext(actor.tenantId);
    await this.assertActiveTenant(actor.tenantId);

    const existing = await this.prisma.attendanceSession.findFirst({
      where: { id: sessionId, tenantId: actor.tenantId },
      select: {
        id: true,
        status: true,
        _count: { select: { records: true } },
      },
    });

    if (!existing) {
      throw new NotFoundException('Attendance session not found');
    }

    if (existing.status !== AttendanceSessionStatus.DRAFT) {
      throw new ConflictException('Only draft sessions can be submitted');
    }

    if (existing._count.records === 0) {
      throw new BadRequestException(
        'Cannot submit an empty attendance register',
      );
    }

    const session = await this.prisma.attendanceSession.update({
      where: { id: sessionId, tenantId: actor.tenantId },
      data: { status: AttendanceSessionStatus.SUBMITTED },
      select: sessionDetailSelect,
    });

    return this.toSessionDetail(session);
  }

  async lockSession(
    actor: AttendanceActorContext,
    sessionId: string,
  ): Promise<AttendanceSessionDetail> {
    this.assertTenantContext(actor.tenantId);
    await this.assertActiveTenant(actor.tenantId);

    const existing = await this.prisma.attendanceSession.findFirst({
      where: { id: sessionId, tenantId: actor.tenantId },
      select: { id: true, status: true },
    });

    if (!existing) {
      throw new NotFoundException('Attendance session not found');
    }

    if (existing.status !== AttendanceSessionStatus.SUBMITTED) {
      throw new ConflictException(
        'Only submitted sessions can be locked',
      );
    }

    const session = await this.prisma.attendanceSession.update({
      where: { id: sessionId, tenantId: actor.tenantId },
      data: { status: AttendanceSessionStatus.LOCKED },
      select: sessionDetailSelect,
    });

    return this.toSessionDetail(session);
  }

  async getSessionRoster(
    tenantId: string,
    sessionId: string,
  ): Promise<AttendanceRosterEntry[]> {
    this.assertTenantContext(tenantId);

    const session = await this.prisma.attendanceSession.findFirst({
      where: { id: sessionId, tenantId },
      select: {
        id: true,
        classroomId: true,
        term: { select: { academicYearId: true } },
      },
    });

    if (!session) {
      throw new NotFoundException('Attendance session not found');
    }

    const [enrollments, records] = await Promise.all([
      this.prisma.enrollment.findMany({
        where: {
          tenantId,
          classroomId: session.classroomId,
          academicYearId: session.term.academicYearId,
          status: EnrollmentStatus.ACTIVE,
        },
        select: {
          student: {
            select: {
              id: true,
              admissionNumber: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: [{ student: { lastName: 'asc' } }],
      }),
      this.prisma.attendanceRecord.findMany({
        where: { tenantId, sessionId },
        select: {
          id: true,
          studentId: true,
          status: true,
          remarks: true,
        },
      }),
    ]);

    const recordsByStudent = new Map(
      records.map((record) => [record.studentId, record]),
    );

    return enrollments.map((enrollment) => {
      const record = recordsByStudent.get(enrollment.student.id);

      return {
        student: enrollment.student,
        recordId: record?.id ?? null,
        status: record?.status ?? null,
        remarks: record?.remarks ?? null,
      };
    });
  }

  async saveRecords(
    actor: AttendanceActorContext,
    sessionId: string,
    input: SaveAttendanceRecordsInput,
  ): Promise<AttendanceSessionDetail> {
    this.assertTenantContext(actor.tenantId);
    await this.assertActiveTenant(actor.tenantId);

    if (input.records.length === 0) {
      throw new BadRequestException('At least one attendance record is required');
    }

    const session = await this.prisma.attendanceSession.findFirst({
      where: { id: sessionId, tenantId: actor.tenantId },
      select: {
        id: true,
        status: true,
        classroomId: true,
        term: { select: { academicYearId: true } },
      },
    });

    if (!session) {
      throw new NotFoundException('Attendance session not found');
    }

    if (session.status === AttendanceSessionStatus.LOCKED) {
      throw new ConflictException('Attendance session is locked');
    }

    const studentIds = input.records.map((record) => record.studentId);

    if (new Set(studentIds).size !== studentIds.length) {
      throw new BadRequestException(
        'Duplicate students in attendance payload',
      );
    }

    const [students, enrollments] = await Promise.all([
      this.prisma.student.findMany({
        where: { tenantId: actor.tenantId, id: { in: studentIds } },
        select: { id: true },
      }),
      this.prisma.enrollment.findMany({
        where: {
          tenantId: actor.tenantId,
          classroomId: session.classroomId,
          academicYearId: session.term.academicYearId,
          studentId: { in: studentIds },
          status: EnrollmentStatus.ACTIVE,
        },
        select: { studentId: true },
      }),
    ]);

    const foundStudentIds = new Set(students.map((student) => student.id));

    if (studentIds.some((studentId) => !foundStudentIds.has(studentId))) {
      throw new NotFoundException('One or more students were not found');
    }

    const enrolledStudentIds = new Set(
      enrollments.map((enrollment) => enrollment.studentId),
    );

    if (
      studentIds.some((studentId) => !enrolledStudentIds.has(studentId))
    ) {
      throw new BadRequestException(
        'One or more students are not enrolled in this classroom',
      );
    }

    try {
      await this.prisma.$transaction(
        input.records.map((record) =>
          this.prisma.attendanceRecord.upsert({
            where: {
              tenantId_sessionId_studentId: {
                tenantId: actor.tenantId,
                sessionId,
                studentId: record.studentId,
              },
            },
            create: {
              tenantId: actor.tenantId,
              sessionId,
              studentId: record.studentId,
              status: record.status,
              remarks: this.normalizeNullableString(record.remarks),
            },
            update: {
              status: record.status,
              remarks: this.normalizeNullableString(record.remarks),
            },
            select: { id: true },
          }),
        ),
      );
    } catch (error) {
      this.rethrowSessionWriteError(error);
    }

    return this.getSession(actor.tenantId, sessionId);
  }

  async updateRecord(
    actor: AttendanceActorContext,
    recordId: string,
    input: UpdateAttendanceRecordInput,
  ): Promise<AttendanceRecordSummary> {
    this.assertTenantContext(actor.tenantId);
    await this.assertActiveTenant(actor.tenantId);

    const existing = await this.prisma.attendanceRecord.findFirst({
      where: { id: recordId, tenantId: actor.tenantId },
      select: {
        id: true,
        session: { select: { status: true } },
      },
    });

    if (!existing) {
      throw new NotFoundException('Attendance record not found');
    }

    if (existing.session.status === AttendanceSessionStatus.LOCKED) {
      throw new ConflictException('Attendance session is locked');
    }

    const data: Prisma.AttendanceRecordUncheckedUpdateInput = {};

    if (input.status !== undefined) {
      data.status = input.status;
    }

    if (input.remarks !== undefined) {
      data.remarks = this.normalizeNullableString(input.remarks);
    }

    try {
      const record = await this.prisma.attendanceRecord.update({
        where: { id: recordId, tenantId: actor.tenantId },
        data,
        select: attendanceRecordSelect,
      });

      return this.toRecordSummary(record);
    } catch (error) {
      this.rethrowSessionWriteError(error);
    }
  }

  private buildSessionWhere(
    tenantId: string,
    query: ListAttendanceSessionsQuery,
  ): Prisma.AttendanceSessionWhereInput {
    const where: Prisma.AttendanceSessionWhereInput = { tenantId };

    if (query.classroomId) {
      where.classroomId = query.classroomId;
    }

    if (query.termId) {
      where.termId = query.termId;
    }

    if (query.subjectId) {
      where.subjectId = query.subjectId;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.period) {
      where.period = query.period;
    }

    if (query.dateFrom || query.dateTo) {
      const dateFrom = query.dateFrom
        ? this.toDate(query.dateFrom)
        : undefined;
      const dateTo = query.dateTo ? this.toDate(query.dateTo) : undefined;

      if (dateFrom && dateTo && dateFrom > dateTo) {
        throw new BadRequestException('dateFrom must be before dateTo');
      }

      where.date = {
        ...(dateFrom ? { gte: dateFrom } : {}),
        ...(dateTo ? { lte: dateTo } : {}),
      };
    }

    return where;
  }

  private async assertClassroomInTenant(
    tenantId: string,
    classroomId: string,
  ): Promise<void> {
    const classroom = await this.prisma.classroom.findFirst({
      where: { id: classroomId, tenantId },
      select: { id: true },
    });

    if (!classroom) {
      throw new NotFoundException('Classroom not found');
    }
  }

  private async assertTermInTenant(
    tenantId: string,
    termId: string,
  ): Promise<void> {
    const term = await this.prisma.term.findFirst({
      where: { id: termId, tenantId },
      select: { id: true },
    });

    if (!term) {
      throw new NotFoundException('Term not found');
    }
  }

  private async assertSubjectInTenant(
    tenantId: string,
    subjectId: string,
  ): Promise<void> {
    const subject = await this.prisma.subject.findFirst({
      where: { id: subjectId, tenantId },
      select: { id: true },
    });

    if (!subject) {
      throw new NotFoundException('Subject not found');
    }
  }

  private async assertStaffInTenant(
    tenantId: string,
    staffId: string,
  ): Promise<void> {
    const staff = await this.prisma.staff.findFirst({
      where: { id: staffId, tenantId },
      select: { id: true },
    });

    if (!staff) {
      throw new NotFoundException('Staff member not found');
    }
  }

  private async resolveTakenById(
    actor: AttendanceActorContext,
    takenById?: string | null,
  ): Promise<string | null> {
    if (takenById === null) {
      return null;
    }

    if (takenById !== undefined) {
      await this.assertStaffInTenant(actor.tenantId, takenById);
      return takenById;
    }

    const staff = await this.prisma.staff.findFirst({
      where: { tenantId: actor.tenantId, userId: actor.id },
      select: { id: true },
    });

    return staff?.id ?? null;
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

  private normalizeNullableString(value?: string | null): string | null {
    if (value === undefined || value === null) {
      return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private rethrowSessionWriteError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        throw new ConflictException(
          'An attendance session already exists for this class, date, and period',
        );
      }

      if (error.code === 'P2025') {
        throw new NotFoundException(
          'Attendance session, record, or related entity not found',
        );
      }

      if (error.code === 'P2003') {
        throw new ConflictException('Related record does not exist');
      }
    }

    throw error;
  }

  private toSessionSummary(
    record: SessionSummaryRecord,
  ): AttendanceSessionSummary {
    return {
      id: record.id,
      tenantId: record.tenantId,
      classroomId: record.classroomId,
      termId: record.termId,
      subjectId: record.subjectId,
      period: record.period,
      date: this.toDateOnly(record.date),
      status: record.status,
      takenById: record.takenById,
      notes: record.notes,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
      classroom: {
        id: record.classroom.id,
        name: record.classroom.name,
        code: record.classroom.code,
      },
      term: {
        id: record.term.id,
        name: record.term.name,
      },
      subject: record.subject
        ? {
            id: record.subject.id,
            name: record.subject.name,
            code: record.subject.code,
          }
        : null,
      takenBy: record.takenBy
        ? {
            id: record.takenBy.id,
            firstName: record.takenBy.firstName,
            lastName: record.takenBy.lastName,
          }
        : null,
      recordCount: record._count.records,
    };
  }

  private toSessionDetail(
    record: SessionDetailRecord,
  ): AttendanceSessionDetail {
    const records = record.records.map((item) =>
      this.toRecordSummary(item),
    );

    return {
      ...this.toSessionSummary(record),
      records,
      summary: this.summarize(records),
    };
  }

  private toRecordSummary(
    record: RecordSummaryRecord,
  ): AttendanceSessionDetail['records'][number] {
    return {
      id: record.id,
      sessionId: record.sessionId,
      studentId: record.studentId,
      status: record.status,
      remarks: record.remarks,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
      student: {
        id: record.student.id,
        admissionNumber: record.student.admissionNumber,
        firstName: record.student.firstName,
        lastName: record.student.lastName,
      },
    };
  }

  private summarize(
    records: AttendanceSessionDetail['records'],
  ): AttendanceSummary {
    const summary: AttendanceSummary = {
      total: records.length,
      present: 0,
      absent: 0,
      late: 0,
      excused: 0,
      holiday: 0,
    };

    for (const record of records) {
      switch (record.status) {
        case AttendanceStatus.PRESENT:
          summary.present += 1;
          break;
        case AttendanceStatus.ABSENT:
          summary.absent += 1;
          break;
        case AttendanceStatus.LATE:
          summary.late += 1;
          break;
        case AttendanceStatus.EXCUSED:
          summary.excused += 1;
          break;
        case AttendanceStatus.HOLIDAY:
          summary.holiday += 1;
          break;
      }
    }

    return summary;
  }
}
