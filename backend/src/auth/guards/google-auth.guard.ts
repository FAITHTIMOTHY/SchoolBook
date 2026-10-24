import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
  type ExecutionContext,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { AuthService } from '../auth.service.js';

@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {
    super();
  }

  async getAuthenticateOptions(context: ExecutionContext) {
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.configService.get<string>('GOOGLE_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      throw new ServiceUnavailableException('Google OAuth is not configured');
    }

    const request = context.switchToHttp().getRequest<Request>();
    const tenant =
      typeof request.query.tenant === 'string' ? request.query.tenant.trim().toLowerCase() : '';

    if (!tenant) {
      throw new BadRequestException('The tenant query parameter is required');
    }

    const state = await this.authService.createOAuthState(tenant);

    return {
      scope: ['email', 'profile'],
      state,
      prompt: 'select_account',
    };
  }
}
