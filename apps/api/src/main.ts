import * as path from 'node:path';
import { existsSync } from 'node:fs';
import * as dotenv from 'dotenv';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

function loadEnvFiles() {
  const candidates = [
    path.resolve(process.cwd(), 'apps/api/.env'),
    path.resolve(process.cwd(), '.env'),
    path.resolve(__dirname, '../.env'),
    path.resolve(__dirname, '../../../.env'),
  ];

  for (const filePath of candidates) {
    if (existsSync(filePath)) {
      dotenv.config({ path: filePath, override: false });
    }
  }
}

loadEnvFiles();

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();

  const port = Number(process.env.PORT ?? 3002);
  const maxRetries = 8;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      await app.listen(port);
      return;
    } catch (error) {
      const isAddressInUse =
        error instanceof Error &&
        'code' in error &&
        (error as { code?: string }).code === 'EADDRINUSE';

      if (!isAddressInUse || attempt === maxRetries) {
        throw error;
      }

      await sleep(300);
    }
  }
}
void bootstrap();
