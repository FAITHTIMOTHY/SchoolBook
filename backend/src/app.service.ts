import { Injectable } from '@nestjs/common';
import { SupabaseService } from './supabase/supabase.service.js';

@Injectable()
export class AppService {
  constructor(private readonly supabase: SupabaseService) {}

  getStatus() {
    return {
      status: 'ok',
      service: 'schoolbook-backend',
      version: process.env.npm_package_version ?? '0.0.1',
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      supabase: this.supabase.isConfigured() ? 'configured' : 'credentials_pending',
      health: '/health',
    };
  }
}
