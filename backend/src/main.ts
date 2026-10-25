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
