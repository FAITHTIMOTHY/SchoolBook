import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { AttendanceStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

export interface ClassAttendanceSummary {
  classroomId: string;
  classroomName: string;
  termId?: string | null;
  totalSessions: number;
  totalRecords: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  holiday: number;
  attendancePercentage: number;
}

export interface StudentAttendanceHistoryItem {
  sessionId: string;
  date: string;
  classroomName: string;
  period: string;
  status: AttendanceStatus;
  remarks: string | null;
}

export interface StudentAttendanceHistory {
  studentId: string;
  student: {
    id: string;
    admissionNumber: string;
    firstName: string;
    lastName: string;
  };
  summary: {
    total: number;
    present: number;
    absent: number;
    late: number;
    excused: number;
    holiday: number;
    attendancePercentage: number;
  };
  data: StudentAttendanceHistoryItem[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface StaffAttendanceReportItem {
  staffId: string;
  staff: {
    id: string;
    firstName: string;
    lastName: string;
    employeeNumber: string;
    departmentId: string | null;
  };
  totalDays: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  holiday: number;
  attendancePercentage: number;
}

export interface StaffAttendanceReport {
  dateFrom?: string | null;
  dateTo?: string | null;
  data: StaffAttendanceReportItem[];
}

@Injectable()
export class AttendanceReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getClassAttendanceSummary(
    tenantId: string,
    query: {
      classroomId?: string;
      termId?: string;
      dateFrom?: string;
      dateTo?: string;
    },
  ): Promise<ClassAttendanceSummary[]> {
    this.assertTenantContext(tenantId);

    const where: Prisma.AttendanceSessionWhereInput = { tenantId };

    if (query.classroomId) {
      where.classroomId = query.classroomId;
    }
    if (query.termId) {
      where.termId = query.termId;
    }
    if (query.dateFrom || query.dateTo) {
      const dateFrom = query.dateFrom ? this.toDate(query.dateFrom) : undefined;
      const dateTo = query.dateTo ? this.toDate(query.dateTo) : undefined;
      if (dateFrom && dateTo && dateFrom > dateTo) {
        throw new BadRequestException('dateFrom must be before dateTo');
      }
      where.date = {
        ...(dateFrom ? { gte: dateFrom } : {}),
        ...(dateTo ? { lte: dateTo } : {}),
      };
    }

    const sessions = await this.prisma.attendanceSession.findMany({
      where,
      select: {
        id: true,
        classroomId: true,
        termId: true,
        classroom: { select: { name: true } },
        records: { select: { status: true } },
      },
    });

    const map = new Map<string, any>();

    for (const session of sessions) {
      const key = query.classroomId ? session.classroomId : `${session.classroomId}:${session.termId ?? ''}`;
      if (!map.has(key)) {
        map.set(key, {
          classroomId: session.classroomId,
          classroomName: session.classroom.name,
          termId: query.termId ? session.termId : null,
          totalSessions: 0,
          totalRecords: 0,
          present: 0,
          absent: 0,
          late: 0,
          excused: 0,
          holiday: 0,
        });
      }

      const entry = map.get(key);
      entry.totalSessions += 1;
      for (const record of session.records) {
        entry.totalRecords += 1;
        if (record.status === AttendanceStatus.PRESENT) entry.present += 1;
        else if (record.status === AttendanceStatus.ABSENT) entry.absent += 1;
        else if (record.status === AttendanceStatus.LATE) entry.late += 1;
        else if (record.status === AttendanceStatus.EXCUSED) entry.excused += 1;
        else if (record.status === AttendanceStatus.HOLIDAY) entry.holiday += 1;
      }
    }

    const results: ClassAttendanceSummary[] = [];
    for (const entry of map.values()) {
      const attendancePercentage =
        entry.totalRecords === 0 ? 0 : Math.round((entry.present / entry.totalRecords) * 10000) / 100;
      results.push({ ...entry, attendancePercentage });
    }

    return results;
  }

  async getStudentAttendanceHistory(
    tenantId: string,
    query: {
      studentId?: string;
      classroomId?: string;
      termId?: string;
      dateFrom?: string;
      dateTo?: string;
      page?: number;
      pageSize?: number;
    },
  ): Promise<StudentAttendanceHistory> {
    this.assertTenantContext(tenantId);

    if (!query.studentId) {
      throw new BadRequestException('studentId is required');
    }

    const student = await this.prisma.student.findFirst({
      where: { id: query.studentId, tenantId },
      select: { id: true, admissionNumber: true, firstName: true, lastName: true },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    const page = Math.max(1, Math.trunc(query.page ?? 1));
    const pageSize = Math.min(100, Math.max(1, Math.trunc(query.pageSize ?? 20)));

    const where: Prisma.AttendanceRecordWhereInput = { tenantId, studentId: query.studentId };
    if (query.classroomId || query.termId || query.dateFrom || query.dateTo) {
      where.session = {};
      if (query.classroomId) where.session.classroomId = query.classroomId;
      if (query.termId) where.session.termId = query.termId;
      if (query.dateFrom || query.dateTo) {
        const dateFrom = query.dateFrom ? this.toDate(query.dateFrom) : undefined;
        const dateTo = query.dateTo ? this.toDate(query.dateTo) : undefined;
        if (dateFrom && dateTo && dateFrom > dateTo) {
          throw new BadRequestException('dateFrom must be before dateTo');
        }
        where.session.date = {
          ...(dateFrom ? { gte: dateFrom } : {}),
          ...(dateTo ? { lte: dateTo } : {}),
        };
      }
    }

    const [records, total, allRecords] = await this.prisma.$transaction([
      this.prisma.attendanceRecord.findMany({
        where,
        select: {
          id: true,
          status: true,
          remarks: true,
          session: {
            select: {
              id: true,
              date: true,
              period: true,
              classroom: { select: { name: true } },
            },
          },
        },
        orderBy: { session: { date: 'desc' } },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.attendanceRecord.count({ where }),
      this.prisma.attendanceRecord.findMany({
        where,
        select: { status: true },
      }),
    ]);

    const summary = {
      total: allRecords.length,
      present: 0,
      absent: 0,
      late: 0,
      excused: 0,
      holiday: 0,
    };

    for (const r of allRecords) {
      if (r.status === AttendanceStatus.PRESENT) summary.present += 1;
      else if (r.status === AttendanceStatus.ABSENT) summary.absent += 1;
      else if (r.status === AttendanceStatus.LATE) summary.late += 1;
      else if (r.status === AttendanceStatus.EXCUSED) summary.excused += 1;
      else if (r.status === AttendanceStatus.HOLIDAY) summary.holiday += 1;
    }

    const attendancePercentage = summary.total === 0 ? 0 : Math.round((summary.present / summary.total) * 10000) / 100;

    return {
      studentId: student.id,
      student,
      summary: { ...summary, attendancePercentage },
      data: records.map((record) => ({
        sessionId: record.session.id,
        date: this.toDateOnly(record.session.date),
        classroomName: record.session.classroom.name,
        period: record.session.period,
        status: record.status,
        remarks: record.remarks,
      })),
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  }

  async getStaffAttendanceReport(
    tenantId: string,
    query: {
      staffId?: string;
      departmentId?: string;
      dateFrom?: string;
      dateTo?: string;
    },
  ): Promise<StaffAttendanceReport> {
    this.assertTenantContext(tenantId);

    const where: Prisma.StaffAttendanceWhereInput = { tenantId };

    if (query.staffId) {
      where.staffId = query.staffId;
    }
    if (query.departmentId) {
      where.staff = { departmentId: query.departmentId };
    }
    if (query.dateFrom || query.dateTo) {
      const dateFrom = query.dateFrom ? this.toDate(query.dateFrom) : undefined;
      const dateTo = query.dateTo ? this.toDate(query.dateTo) : undefined;
      if (dateFrom && dateTo && dateFrom > dateTo) {
        throw new BadRequestException('dateFrom must be before dateTo');
      }
      where.date = {
        ...(dateFrom ? { gte: dateFrom } : {}),
        ...(dateTo ? { lte: dateTo } : {}),
      };
    }

    const records = await this.prisma.staffAttendance.findMany({
      where,
      select: {
        staffId: true,
        status: true,
        staff: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeNumber: true,
            departmentId: true,
          },
        },
      },
    });

    const map = new Map<string, any>();

    for (const record of records) {
      if (!map.has(record.staffId)) {
        map.set(record.staffId, {
          staffId: record.staffId,
          staff: record.staff,
          totalDays: 0,
          present: 0,
          absent: 0,
          late: 0,
          excused: 0,
          holiday: 0,
        });
      }

      const entry = map.get(record.staffId);
      entry.totalDays += 1;
      if (record.status === AttendanceStatus.PRESENT) entry.present += 1;
      else if (record.status === AttendanceStatus.ABSENT) entry.absent += 1;
      else if (record.status === AttendanceStatus.LATE) entry.late += 1;
      else if (record.status === AttendanceStatus.EXCUSED) entry.excused += 1;
      else if (record.status === AttendanceStatus.HOLIDAY) entry.holiday += 1;
    }

    const data: StaffAttendanceReportItem[] = [];
    for (const entry of map.values()) {
      const attendancePercentage = entry.totalDays === 0 ? 0 : Math.round((entry.present / entry.totalDays) * 10000) / 100;
      data.push({ ...entry, attendancePercentage });
    }

    return {
      dateFrom: query.dateFrom ?? null,
      dateTo: query.dateTo ?? null,
      data,
    };
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
}
