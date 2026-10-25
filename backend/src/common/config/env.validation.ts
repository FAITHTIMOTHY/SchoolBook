/**
 * Fail-fast environment validation.
 *
 * Runs inside ConfigModule.forRoot({ validate }) so the process refuses to
 * start with an incomplete or unsafe configuration instead of failing later
 * at the first request.
 */
export function validateEnv(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const errors: string[] = [];

  const nodeEnv = readString(config.NODE_ENV) ?? 'development';
  const isProduction = nodeEnv === 'production';

  const databaseUrl = readString(config.DATABASE_URL);
  const directUrl = readString(config.DIRECT_URL);
  const jwtSecret = readString(config.JWT_SECRET);
  const frontendUrl = readString(config.FRONTEND_URL);
  const portRaw = readString(config.PORT) ?? '3000';
  const port = Number(portRaw);

  if (!databaseUrl) {
    errors.push('DATABASE_URL is required');
  }

  if (!jwtSecret) {
    errors.push('JWT_SECRET is required');
  } else if (jwtSecret.length < 32) {
    errors.push('JWT_SECRET must be at least 32 characters long');
  }

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    errors.push(`PORT must be an integer between 1 and 65535 (received "${portRaw}")`);
  }

  if (isProduction && !frontendUrl) {
    errors.push('FRONTEND_URL is required when NODE_ENV=production');
  }

  if (isProduction && !directUrl) {
    errors.push('DIRECT_URL is required when NODE_ENV=production (used by Prisma migrations)');
  }

  const googleClientId = readString(config.GOOGLE_CLIENT_ID);
  const googleClientSecret = readString(config.GOOGLE_CLIENT_SECRET);
  if (Boolean(googleClientId) !== Boolean(googleClientSecret)) {
    errors.push('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set together');
  }

  if (isProduction && databaseUrl && !/(sslmode=require|sslmode=verify-full)/i.test(databaseUrl)) {
    // Managed providers normally include this. Warn instead of blocking boot so
    // private-network / proxy-terminated TLS setups are still possible.
    console.warn(
      '[env] DATABASE_URL does not declare sslmode=require; verify that TLS is enforced by the provider.',
    );
  }

  if (errors.length > 0) {
    throw new Error(
      `Invalid environment configuration:\n - ${errors.join('\n - ')}`,
    );
  }

  return {
    ...config,
    NODE_ENV: nodeEnv,
    PORT: port,
  };
}

function readString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
