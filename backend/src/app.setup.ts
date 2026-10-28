if (process.env.NODE_ENV !== 'production' || process.env.DATABASE_URL?.includes('supabase.com')) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ExpressAdapter } from '@nestjs/platform-express';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Express, NextFunction, Request, Response } from 'express';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { requestLogger } from './common/middleware/request-logger.middleware.js';
import { resolveFrontendDir } from './common/paths.js';

/**
 * Applies the HTTP-layer configuration shared by the standalone server, the
 * Docker image, and the Vercel serverless entrypoint.
 */
export function configureApp(app: NestExpressApplication): void {
  const configService = app.get(ConfigService);
  const nodeEnv = configService.get<string>('NODE_ENV') ?? 'development';
  const isProduction = nodeEnv === 'production';

  const expressInstance = app.getHttpAdapter().getInstance();
  expressInstance.disable('x-powered-by');

  const trustProxy = configService.get<string>('TRUST_PROXY');
  if (trustProxy) {
    app.set('trust proxy', Number(trustProxy) || 1);
  }

  // Vercel terminates TLS and applies the CSP and security headers declared in
  // vercel.json, so installing Helmet there would duplicate the CSP header.
  if (!process.env.VERCEL) {
    // The current frontend still uses inline scripts, styles, and event
    // handlers, so inline script/style must stay allowed for now. The remaining
    // directives still block framing, object embeds, and unexpected origins.
    app.use(
      helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            baseUri: ["'self'"],
            objectSrc: ["'none'"],
            frameAncestors: ["'none'"],
            imgSrc: ["'self'", 'data:', 'https:'],
            styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            scriptSrcAttr: ["'unsafe-inline'"],
            connectSrc: ["'self'"],
            fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
            formAction: ["'self'"],
          },
        },
        crossOriginResourcePolicy: { policy: 'cross-origin' },
      }),
    );
  }

  app.use(requestLogger);
  app.useGlobalFilters(new AllExceptionsFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  const allowedOrigins = (configService.get<string>('FRONTEND_URL') ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: (origin, callback) => {
      // Same-origin requests and server-to-server calls have no Origin header.
      if (!origin) {
        callback(null, true);
        return;
      }

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      if (!isProduction && /^http:\/\/localhost(:\d+)?$/.test(origin)) {
        callback(null, true);
        return;
      }

      callback(null, false);
    },
    credentials: true,
  });

  const frontendDir = resolveFrontendDir();

  app.useStaticAssets(frontendDir, {
    index: false,
    maxAge: isProduction ? '1h' : 0,
  });

  // The marketing page and the application shell are served outside the API
  // prefix. Register them before Nest's router is initialised by listen().
  const httpServer = app.getHttpAdapter().getInstance();

  const sendHtml = (file: string, res: Response, next: NextFunction) => {
    const target = join(frontendDir, file);

    if (!existsSync(target)) {
      next();
      return;
    }

    res.sendFile(target, (error) => {
      if (error) {
        next(error);
      }
    });
  };

  httpServer.use((req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET') {
      next();
      return;
    }

    const pathname = req.path;

    if (pathname === '/' || pathname === '/landing') {
      sendHtml('landing.html', res, next);
      return;
    }

    if (pathname === '/login') {
      sendHtml('login.html', res, next);
      return;
    }

    if (pathname === '/reset-password') {
      sendHtml('reset-password.html', res, next);
      return;
    }

    if (pathname === '/verify-email') {
      sendHtml('verify-email.html', res, next);
      return;
    }

    if (
      pathname === '/app' ||
      pathname === '/dashboard' ||
      pathname.startsWith('/app/') ||
      pathname.startsWith('/dashboard/')
    ) {
      sendHtml('index.html', res, next);
      return;
    }

    next();
  });

  app.setGlobalPrefix('api', {
    exclude: ['health', 'health/live', 'health/ready'],
  });
}

/**
 * Creates a configured Nest application.
 *
 * Pass an existing Express instance when embedding the app in a host that
 * owns the HTTP server (for example the Vercel serverless entrypoint).
 */
export async function createApp(
  expressInstance?: Express,
): Promise<NestExpressApplication> {
  const app = await NestFactory.create<NestExpressApplication>(
    AppModule,
    new ExpressAdapter(expressInstance),
  );

  configureApp(app);

  return app;
}
