import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private readonly logger = new Logger(SupabaseService.name);
  private client: SupabaseClient | null = null;
  private adminClient: SupabaseClient | null = null;

  constructor(private readonly configService: ConfigService) {
    this.initClients();
  }

  private initClients() {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseAnonKey = this.configService.get<string>('SUPABASE_ANON_KEY');
    const supabaseServiceRoleKey = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY');

    if (supabaseUrl && supabaseAnonKey && !supabaseUrl.includes('your-project-ref')) {
      this.client = createClient(supabaseUrl, supabaseAnonKey);
      this.logger.log('Supabase client initialized successfully');
    } else {
      this.logger.warn('Supabase URL or Anon Key is missing or using placeholders in .env');
    }

    if (supabaseUrl && supabaseServiceRoleKey && !supabaseUrl.includes('your-project-ref')) {
      this.adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });
      this.logger.log('Supabase admin (service-role) client initialized successfully');
    }
  }

  /**
   * Returns standard client (respects Row Level Security using Anon key or User token)
   */
  getClient(): SupabaseClient {
    if (!this.client) {
      throw new Error(
        'Supabase client is not configured. Please set SUPABASE_URL and SUPABASE_ANON_KEY in .env',
      );
    }
    return this.client;
  }

  /**
   * Returns admin client with service role (bypasses RLS for system operations)
   */
  getAdminClient(): SupabaseClient {
    if (!this.adminClient) {
      throw new Error(
        'Supabase admin client is not configured. Please set SUPABASE_SERVICE_ROLE_KEY in .env',
      );
    }
    return this.adminClient;
  }

  /**
   * Helper to check whether Supabase is configured
   */
  isConfigured(): boolean {
    return this.client !== null;
  }
}
