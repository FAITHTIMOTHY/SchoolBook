import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service.js';
import { AUTH_COOKIE_NAME, REFRESH_TOKEN_COOKIE_NAME } from './auth.constants.js';
import type { AuthenticatedUser } from './auth.types.js';
import { CurrentUser } from './decorators/current-user.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import { GoogleAuthGuard } from './guards/google-auth.guard.js';
import { RefreshTokensService } from './refresh-tokens/refresh-tokens.service.js';
import { LocalAuthService } from './local-auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { ForgotPasswordDto, ResetPasswordDto, VerifyEmailDto } from './dto/password.dto.js';
import { PasswordService } from './password.service.js';
import { EmailService } from '../common/email/email.service.js';
import { UseGuards } from '@nestjs/common';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
    private readonly refreshTokensService: RefreshTokensService,
    private readonly localAuthService: LocalAuthService,
    private readonly passwordService: PasswordService,
    private readonly emailService: EmailService,
  ) {}

  @Public()
  @Get('providers')
  providers() {
    return {
      google: Boolean(
        this.configService.get<string>('GOOGLE_CLIENT_ID') &&
          this.configService.get<string>('GOOGLE_CLIENT_SECRET'),
      ),
      passwordReset: this.emailService.isConfigured(),
    };
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Get('google')
  @UseGuards(GoogleAuthGuard)
  googleLogin(): void {
    return;
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  async googleCallback(
    @Req() request: Request & { user: AuthenticatedUser },
    @Res() response: Response,
  ): Promise<void> {
    const { accessToken, refreshToken } = await this.authService.issueTokens(request.user);

    response.cookie(AUTH_COOKIE_NAME, accessToken, this.authService.cookieOptions());
    response.cookie(REFRESH_TOKEN_COOKIE_NAME, refreshToken, this.authService.refreshCookieOptions());

    const redirectUrl =
      this.configService.get<string>('AUTH_SUCCESS_REDIRECT_URL') ??
      this.configService.get<string>('FRONTEND_URL') ??
      '/';

    response.redirect(redirectUrl);
  }

  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return { user };
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('refresh')
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const cookies = (request as any).cookies || {};
    const refreshToken =
      cookies[REFRESH_TOKEN_COOKIE_NAME] ||
      (request.headers.cookie
        ? (() => {
            const cookieHeader = request.headers.cookie as string;
            for (const part of cookieHeader.split(';')) {
              const separatorIndex = part.indexOf('=');
              if (separatorIndex === -1) continue;
              const name = part.slice(0, separatorIndex).trim();
              if (name === REFRESH_TOKEN_COOKIE_NAME) {
                return decodeURIComponent(part.slice(separatorIndex + 1).trim());
              }
            }
            return null;
          })()
        : null);

    if (!refreshToken) {
      throw new (await import('@nestjs/common')).UnauthorizedException('Refresh token missing');
    }

    const rotated = await this.refreshTokensService.rotateRefreshToken(refreshToken);
    const accessToken = await this.authService.issueAccessToken({
      id: rotated.userId,
      tenantId: rotated.tenantId,
      email: rotated.email,
      role: rotated.role,
      tenantSlug: rotated.tenantSlug,
      firstName: rotated.firstName,
      lastName: rotated.lastName,
      avatarUrl: rotated.avatarUrl,
    } as AuthenticatedUser);

    response.cookie(AUTH_COOKIE_NAME, accessToken, this.authService.cookieOptions());
    response.cookie(REFRESH_TOKEN_COOKIE_NAME, rotated.newRefreshToken, this.authService.refreshCookieOptions());

    return { success: true };
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.localAuthService.login(dto);
    response.cookie(AUTH_COOKIE_NAME, result.accessToken, this.authService.cookieOptions());
    response.cookie(REFRESH_TOKEN_COOKIE_NAME, result.refreshToken, this.authService.refreshCookieOptions());
    return { user: result.user };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.passwordService.requestPasswordReset(dto.tenantSlug, dto.email);
    return { success: true };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.passwordService.resetPassword(dto.tenantSlug, dto.token, dto.password);
    return { success: true };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('verify-email')
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    await this.passwordService.verifyEmail(dto.tenantSlug, dto.token);
    return { success: true };
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('request-email-verification')
  async requestEmailVerification(@CurrentUser() user: AuthenticatedUser) {
    await this.passwordService.requestEmailVerification(user.tenantId, user.id);
    return { success: true };
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('logout')
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    if (user) {
      await this.refreshTokensService.revokeAllForUser(user.id, user.tenantId);
    }

    response.clearCookie(AUTH_COOKIE_NAME, this.authService.clearCookieOptions());
    response.clearCookie(REFRESH_TOKEN_COOKIE_NAME, this.authService.clearCookieOptions());

    return { success: true };
  }
}
