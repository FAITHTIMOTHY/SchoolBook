import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service.js';
import { SupabaseService } from './supabase/supabase.service.js';

@Injectable()
export class AppService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly supabase: SupabaseService,
  ) {}

  getStatus() {
    return {
      status: 'ok',
      service: 'schoolbook-backend',
      timestamp: new Date().toISOString(),
      prisma: 'ready',
      supabase: this.supabase.isConfigured() ? 'configured' : 'credentials_pending',
    };
  }
}
