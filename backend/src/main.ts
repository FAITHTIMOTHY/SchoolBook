if (process.env.NODE_ENV !== 'production' || process.env.DATABASE_URL?.includes('supabase.com')) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

if (process.env.NODE_ENV !== 'production' || process.env.DATABASE_URL?.includes('supabase.com')) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

import { ConfigService } from '@nestjs/config';
import { createApp } from './app.setup.js';

async function bootstrap() {
  const app = await createApp();

  const configService = app.get(ConfigService);
  const nodeEnv = configService.get<string>('NODE_ENV') ?? 'development';
  const port = Number(configService.get('PORT') ?? 3000);

  app.enableShutdownHooks();

  await app.listen(port, '0.0.0.0');

  // eslint-disable-next-line no-console
  console.log(
    `SchoolBook API listening on 0.0.0.0:${port} (${nodeEnv}). Health: /health`,
  );
}

await bootstrap();

