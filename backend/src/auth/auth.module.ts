import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { ACCESS_TOKEN_TTL_SECONDS } from './auth.constants.js';
import { GoogleStrategy } from './strategies/google.strategy.js';
import { JwtStrategy } from './strategies/jwt.strategy.js';
import { RefreshTokensService } from './refresh-tokens/refresh-tokens.service.js';
import { LocalAuthService } from './local-auth.service.js';
import { PasswordService } from './password.service.js';
import { EmailService } from '../common/email/email.service.js';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: ACCESS_TOKEN_TTL_SECONDS,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, GoogleStrategy, JwtStrategy, RefreshTokensService, LocalAuthService, PasswordService, EmailService],
  exports: [AuthService, JwtModule, PassportModule, RefreshTokensService, LocalAuthService, PasswordService, EmailService],
})
export class AuthModule {}
