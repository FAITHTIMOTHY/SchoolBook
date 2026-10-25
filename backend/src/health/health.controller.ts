import { Controller, Get } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /** Liveness: process is up. Does not touch the database. */
  @Get('live')
  live() {
    return {
      status: 'ok',
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  /** Readiness: process is up and the database answers a query. */
  @Get()
  async ready() {
    return this.checkReadiness();
  }

  @Get('ready')
  async readyAlias() {
    return this.checkReadiness();
  }

  private async checkReadiness() {
    const startedAt = Date.now();
    await this.prisma.$queryRawUnsafe('SELECT 1');

    return {
      status: 'ok',
      checks: { database: 'up' },
      latencyMs: Date.now() - startedAt,
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }
}
