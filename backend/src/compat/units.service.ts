import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { LegacyUnit, MemberActor } from './compat.types.js';

export interface UnitInput {
  name?: string;
  parent_unit_id?: string | null;
  description?: string;
}

@Injectable()
export class UnitsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string): Promise<LegacyUnit[]> {
    const [departments, classrooms] = await Promise.all([
      this.prisma.department.findMany({
        where: { tenantId },
        orderBy: { name: 'asc' },
      }),
      this.prisma.classroom.findMany({
        where: { tenantId },
        orderBy: { name: 'asc' },
      }),
    ]);

    const units: LegacyUnit[] = [
      ...departments.map((department) => ({
        id: department.id,
        tenant_id: department.tenantId,
        name: department.name,
        parent_unit_id: null,
        description: department.description ?? '',
      })),
      ...classrooms.map((classroom) => ({
        id: classroom.id,
        tenant_id: classroom.tenantId,
        name: classroom.name,
        parent_unit_id: null,
        description: [
          classroom.gradeLevel ? `Grade ${classroom.gradeLevel}` : null,
          classroom.section,
          classroom.room ? `Room ${classroom.room}` : null,
        ]
          .filter(Boolean)
          .join(' • '),
      })),
    ];

    return units.sort((left, right) => left.name.localeCompare(right.name));
  }

  async create(input: UnitInput, actor: MemberActor): Promise<LegacyUnit> {
    const name = input.name?.trim();

    if (!name) {
      throw new BadRequestException(
        'Department / class name is required.',
      );
    }

    const [department, classroom] = await Promise.all([
      this.prisma.department.findFirst({
        where: {
          tenantId: actor.tenantId,
          name: { equals: name, mode: 'insensitive' },
        },
        select: { id: true },
      }),
      this.prisma.classroom.findFirst({
        where: {
          tenantId: actor.tenantId,
          name: { equals: name, mode: 'insensitive' },
        },
        select: { id: true },
      }),
    ]);

    if (department || classroom) {
      throw new BadRequestException(
        `A department or class named "${name}" already exists on this campus.`,
      );
    }

    const created = await this.prisma.department.create({
      data: {
        tenantId: actor.tenantId,
        name,
        description: input.description?.trim() || null,
      },
    });

    return {
      id: created.id,
      tenant_id: created.tenantId,
      name: created.name,
      parent_unit_id: null,
      description: created.description ?? '',
    };
  }

  async remove(
    id: string,
    tenantId: string,
  ): Promise<{ success: true; message: string }> {
    const department = await this.prisma.department.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });

    if (department) {
      await this.prisma.$transaction([
        this.prisma.inventoryItem.updateMany({
          where: { tenantId, unitId: id },
          data: { unitId: null, unitKind: null },
        }),
        this.prisma.student.updateMany({
          where: { tenantId, unitId: id },
          data: { unitId: null },
        }),
        this.prisma.department.delete({ where: { id } }),
      ]);

      return {
        success: true,
        message: 'Department deleted and member associations cleared.',
      };
    }

    const classroom = await this.prisma.classroom.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });

    if (!classroom) {
      throw new NotFoundException('Department unit not found.');
    }

    const [enrollments, sessions] = await Promise.all([
      this.prisma.enrollment.count({ where: { tenantId, classroomId: id } }),
      this.prisma.attendanceSession.count({
        where: { tenantId, classroomId: id },
      }),
    ]);

    if (enrollments > 0 || sessions > 0) {
      throw new ConflictException(
        'This class has enrolled students or attendance history and cannot be deleted. Archive it from the academic setup instead.',
      );
    }

    await this.prisma.$transaction([
      this.prisma.inventoryItem.updateMany({
        where: { tenantId, unitId: id },
        data: { unitId: null, unitKind: null },
      }),
      this.prisma.student.updateMany({
        where: { tenantId, unitId: id },
        data: { unitId: null },
      }),
      this.prisma.classroom.delete({ where: { id } }),
    ]);

    return {
      success: true,
      message: 'Class deleted and member associations cleared.',
    };
  }
}
