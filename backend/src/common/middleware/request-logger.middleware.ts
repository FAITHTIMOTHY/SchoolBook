import { Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { NextFunction, Request, Response } from 'express';

const logger = new Logger('HTTP');

/**
 * Structured request log with a correlation id. Deliberately does not log
 * bodies, cookies or query strings, so tokens and credentials never reach the
 * logs.
 */
export function requestLogger(
  request: Request & { id?: string },
  response: Response,
  next: NextFunction,
): void {
  const incomingId = request.headers['x-request-id'];
  const requestId =
    (Array.isArray(incomingId) ? incomingId[0] : incomingId)?.toString().trim() ||
    randomUUID();

  request.id = requestId;
  response.setHeader('x-request-id', requestId);

  const startedAt = process.hrtime.bigint();

  response.on('finish', () => {
    const durationMs =
      Number(process.hrtime.bigint() - startedAt) / 1_000_000;

    logger.log(
      JSON.stringify({
        requestId,
        method: request.method,
        path: request.originalUrl.split('?')[0],
        status: response.statusCode,
        durationMs: Math.round(durationMs * 10) / 10,
      }),
    );
  });

  next();
}
