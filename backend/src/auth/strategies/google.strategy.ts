import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { Strategy, type Profile, type VerifyCallback } from 'passport-google-oauth20';
import { AuthService } from '../auth.service.js';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      clientID: configService.get<string>('GOOGLE_CLIENT_ID') || 'google-client-id-not-configured',
      clientSecret:
        configService.get<string>('GOOGLE_CLIENT_SECRET') ||
        'google-client-secret-not-configured',
      callbackURL:
        configService.get<string>('GOOGLE_CALLBACK_URL') ||
        'http://localhost:3000/auth/google/callback',
      scope: ['email', 'profile'],
      passReqToCallback: true,
    });
  }

  async validate(
    request: Request,
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): Promise<void> {
    try {
      const state = typeof request.query.state === 'string' ? request.query.state : '';

      if (!state) {
        throw new UnauthorizedException('Missing OAuth state');
      }

      const tenantSlug = await this.authService.verifyOAuthState(state);
      const email = profile.emails?.[0]?.value;

      if (!email) {
        throw new UnauthorizedException('Google account has no email address');
      }

      if (profile._json?.email_verified === false) {
        throw new UnauthorizedException('Google email address is not verified');
      }

      const user = await this.authService.validateGoogleLogin({
        tenantSlug,
        googleId: profile.id,
        email,
        firstName: profile.name?.givenName || profile.displayName || 'User',
        lastName: profile.name?.familyName || '',
        avatarUrl: profile.photos?.[0]?.value ?? null,
      });

      done(null, user);
    } catch (error) {
      done(error instanceof Error ? error : new UnauthorizedException(), false);
    }
  }
}
