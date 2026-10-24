import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { FeeStatus, Prisma, StaffStatus, StudentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import type { TenantOverview, TenantProfile } from './tenant.types.js';

const tenantProfileSelect = {
  id: true,
  name: true,
  slug: true,
  code: true,
  email: true,
  phone: true,
  address: true,
  logoUrl: true,
  website: true,
  motto: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.SchoolSelect;

type TenantProfileRecord = Prisma.SchoolGetPayload<{
  select: typeof tenantProfileSelect;
}>;

@Injectable()
export class TenantService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns the school for the authenticated user's verified JWT scope.
   *
   * The tenantId must come from the verified access token (via TenantGuard /
   * @CurrentUser), never from a request body, query string, or header.
   */
  async getCurrentTenant(tenantId: string): Promise<TenantProfile> {
    this.assertTenantContext(tenantId);

    const school = await this.prisma.school.findUnique({
      where: { id: tenantId },
      select: tenantProfileSelect,
    });

    if (!school) {
      throw new NotFoundException('Tenant not found');
    }

    if (!school.isActive) {
      throw new ForbiddenException('Tenant is inactive');
    }

    return this.toTenantProfile(school);
  }

  /**
   * Aggregated read-only metrics for the current tenant dashboard.
   *
   * Every query is explicitly scoped by the verified tenantId.
   */
  async getTenantOverview(tenantId: string): Promise<TenantOverview> {
    this.assertTenantContext(tenantId);
    await this.assertActiveTenant(tenantId);

    const [
      students,
      activeStudents,
      staff,
      activeStaff,
      users,
      classrooms,
      departments,
      attendanceSessions,
      pendingInvoices,
    ] = await this.prisma.$transaction([
      this.prisma.student.count({ where: { tenantId } }),
      this.prisma.student.count({
        where: { tenantId, status: StudentStatus.ACTIVE },
      }),
      this.prisma.staff.count({ where: { tenantId } }),
      this.prisma.staff.count({
        where: { tenantId, status: StaffStatus.ACTIVE },
      }),
      this.prisma.user.count({ where: { tenantId } }),
      this.prisma.classroom.count({ where: { tenantId } }),
      this.prisma.department.count({ where: { tenantId } }),
      this.prisma.attendanceSession.count({ where: { tenantId } }),
      this.prisma.invoice.count({
        where: {
          tenantId,
          status: {
            in: [
              FeeStatus.PENDING,
              FeeStatus.PARTIALLY_PAID,
              FeeStatus.OVERDUE,
            ],
          },
        },
      }),
    ]);

    return {
      tenantId,
      counts: {
        students,
        activeStudents,
        staff,
        activeStaff,
        users,
        classrooms,
        departments,
        attendanceSessions,
        pendingInvoices,
      },
      generatedAt: new Date().toISOString(),
    };
  }

  private assertTenantContext(tenantId: string): void {
    if (!tenantId || !tenantId.trim()) {
      throw new UnauthorizedException('Tenant context missing');
    }
  }

  private async assertActiveTenant(tenantId: string): Promise<void> {
    const school = await this.prisma.school.findUnique({
      where: { id: tenantId },
      select: { id: true, isActive: true },
    });

    if (!school) {
      throw new NotFoundException('Tenant not found');
    }

    if (!school.isActive) {
      throw new ForbiddenException('Tenant is inactive');
    }
  }

  private toTenantProfile(school: TenantProfileRecord): TenantProfile {
    return {
      id: school.id,
      name: school.name,
      slug: school.slug,
      code: school.code,
      email: school.email,
      phone: school.phone,
      address: school.address,
      logoUrl: school.logoUrl,
      website: school.website,
      motto: school.motto,
      isActive: school.isActive,
      createdAt: school.createdAt.toISOString(),
      updatedAt: school.updatedAt.toISOString(),
    };
  }
}
