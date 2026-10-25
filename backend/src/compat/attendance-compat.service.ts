import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  LegacyAttendanceSheetResponse,
  LegacyAttendanceStatsResponse,
  LegacyAttendanceStatus,
  MemberActor,
} from './compat.types.js';
import { MemberMapperService } from './member-mapper.service.js';

export interface MarkAttendanceInput {
  memberId?: string;
  serviceDate?: string;
  serviceName?: string;
  status?: LegacyAttendanceStatus;
}

@Injectable()
export class AttendanceCompatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mapper: MemberMapperService,
  ) {}

  async getSheet(
    tenantId: string,
    date: string | undefined,
    serviceName: string | undefined,
  ): Promise<LegacyAttendanceSheetResponse> {
    const serviceDate = date || today();
    const sessionName = serviceName?.trim() || 'Morning Roll Call';
    const parsedDate = parseServiceDate(serviceDate);

    const [members, records] = await Promise.all([
      this.mapper.listRawMembers(tenantId, { status: 'Active' }),
      this.prisma.serviceAttendance.findMany({
        where: { tenantId, serviceDate: parsedDate, serviceName: sessionName },
        select: { memberId: true, status: true },
      }),
    ]);

    const byMember = new Map(records.map((record) => [record.memberId, record]));

    return {
      serviceDate,
      serviceName: sessionName,
      sheet: members.map((member) => {
        const record = byMember.get(member.id);
        return {
          memberId: member.id,
          memberName: member.name,
          role: member.role,
          position: member.position,
          status: record
            ? record.status === 'PRESENT'
              ? 'Present'
              : 'Absent'
            : 'Absent',
          isMarked: Boolean(record),
        };
      }),
    };
  }

  async mark(
    tenantId: string,
    input: MarkAttendanceInput,
    actor: MemberActor,
  ): Promise<{ success: true; message: string }> {
    if (
      !input.memberId ||
      !input.serviceDate ||
      !input.serviceName ||
      !input.status
    ) {
      throw new BadRequestException(
        'Missing parameters: memberId, serviceDate, serviceName, status.',
      );
    }

    const member = await this.mapper.resolveMember(tenantId, input.memberId);
    if (!member) {
      throw new NotFoundException(
        'Student or faculty member not found under active campus.',
      );
    }

    const serviceDate = parseServiceDate(input.serviceDate);
    const serviceName = input.serviceName.trim();
    const status = input.status === 'Present' ? 'PRESENT' : 'ABSENT';

    await this.prisma.serviceAttendance.upsert({
      where: {
        tenantId_memberId_serviceDate_serviceName: {
          tenantId,
          memberId: member.id,
          serviceDate,
          serviceName,
        },
      },
      update: {
        status,
        recordedById: actor.id,
        recordedAt: new Date(),
      },
      create: {
        tenantId,
        memberId: member.id,
        memberKind: member.kind,
        serviceDate,
        serviceName,
        status,
        recordedById: actor.id,
      },
    });

    return { success: true, message: 'Class attendance recorded.' };
  }

  async closeService(
    tenantId: string,
    serviceDateInput: string | undefined,
    serviceNameInput: string | undefined,
    actor: MemberActor,
  ): Promise<{ success: true; message: string }> {
    if (!serviceDateInput || !serviceNameInput) {
      throw new BadRequestException(
        'serviceDate and serviceName are required.',
      );
    }

    const serviceDate = parseServiceDate(serviceDateInput);
    const serviceName = serviceNameInput.trim();
    const members = await this.mapper.listMemberIds(tenantId);

    const result = await this.prisma.serviceAttendance.createMany({
      data: members.map((member) => ({
        tenantId,
        memberId: member.id,
        memberKind: member.kind,
        serviceDate,
        serviceName,
        status: 'ABSENT' as const,
        recordedById: actor.id,
      })),
      skipDuplicates: true,
    });

    return {
      success: true,
      message: `Session roll call closed. ${result.count} unmarked students/staff automatically marked Absent.`,
    };
  }

  async stats(
    tenantId: string,
    type?: string,
  ): Promise<LegacyAttendanceStatsResponse> {
    const members = await this.mapper.listRawMembers(tenantId, {
      status: 'Active',
    });
    const filtered =
      type === 'workers' || type === 'faculty'
        ? members.filter((member) => member.role !== 'Student')
        : members;

    const records = await this.prisma.serviceAttendance.findMany({
      where: { tenantId },
      select: {
        memberId: true,
        status: true,
        serviceDate: true,
        serviceName: true,
      },
    });

    const byMember = new Map<
      string,
      { total: number; present: number }
    >();
    const byService = new Map<
      string,
      { name: string; date: string; total: number; present: number }
    >();

    for (const record of records) {
      const current = byMember.get(record.memberId) ?? {
        total: 0,
        present: 0,
      };
      current.total += 1;
      if (record.status === 'PRESENT') {
        current.present += 1;
      }
      byMember.set(record.memberId, current);

      const date = record.serviceDate.toISOString().slice(0, 10);
      const serviceKey = `${date}|${record.serviceName}`;
      const service = byService.get(serviceKey) ?? {
        name: record.serviceName,
        date,
        total: 0,
        present: 0,
      };
      service.total += 1;
      if (record.status === 'PRESENT') {
        service.present += 1;
      }
      byService.set(serviceKey, service);
    }

    const memberPerformance = filtered.map((member) => {
      const counts = byMember.get(member.id) ?? { total: 0, present: 0 };
      const attendanceRate =
        counts.total > 0
          ? Math.round((counts.present / counts.total) * 100)
          : 100;

      return {
        memberId: member.id,
        name: member.name,
        role: member.role,
        position: member.position,
        unit_id: member.unit_id,
        presentCount: counts.present,
        totalServices: counts.total,
        attendanceRate,
      };
    });

    const totalRates = memberPerformance.reduce(
      (sum, item) => sum + item.attendanceRate,
      0,
    );
    const avgAttendanceRate =
      memberPerformance.length > 0
        ? Math.round(totalRates / memberPerformance.length)
        : 0;

    const recentServices = [...byService.values()]
      .sort(
        (left, right) =>
          right.date.localeCompare(left.date) ||
          left.name.localeCompare(right.name),
      )
      .slice(0, 5)
      .map((service) => ({
        name: service.name,
        date: service.date,
        present: service.present,
        total: service.total,
        rate:
          service.total > 0
            ? Math.round((service.present / service.total) * 100)
            : 0,
        status:
          service.date === today()
            ? ('Open' as const)
            : ('Closed' as const),
      }));

    return {
      type: type ?? 'all',
      avgAttendanceRate,
      memberPerformance,
      recentServices,
    };
  }
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function parseServiceDate(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new BadRequestException('date must use the YYYY-MM-DD format.');
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException('Invalid service date.');
  }

  return date;
}
