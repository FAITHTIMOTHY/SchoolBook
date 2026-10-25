import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Public } from '../common/decorators/public.decorator.js';
import type { LegacyTenant } from './compat.types.js';

@Controller('tenants')
export class PublicTenantsController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  async list(): Promise<LegacyTenant[]> {
    const schools = await this.prisma.school.findMany({
      where: { isActive: true },
      select: { id: true, name: true, logoUrl: true, slug: true },
      orderBy: { name: 'asc' },
      take: 100,
    });

    return schools.map((school) => ({
      id: school.id,
      name: school.name,
      logo_url: school.logoUrl ?? '',
      slug: school.slug,
    }));
  }
}
