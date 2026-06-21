import * as path from 'node:path';
import { existsSync } from 'node:fs';
import * as dotenv from 'dotenv';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

const bootstrapLogger = new Logger('Bootstrap');

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

function decodeBase64Utf8(value?: string): string | null {
  if (!value) {
    return null;
  }

  try {
    return Buffer.from(value, 'base64').toString('utf8');
  } catch {
    return null;
  }
}

function extractProjectIdFromServiceAccount(
  rawJson?: string | null,
): string | null {
  if (!rawJson) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawJson) as { project_id?: string };
    return parsed.project_id?.trim() || null;
  } catch {
    return null;
  }
}

function extractProjectIdFromBucket(bucketName?: string): string | null {
  const trimmed = bucketName?.trim();
  if (!trimmed) {
    return null;
  }

  const matched = trimmed.match(/^([^.]+)\./);
  return matched?.[1] ?? null;
}

function logGcpIntegrationStatus() {
  const bucketName = process.env.FIREBASE_STORAGE_BUCKET?.trim() || '';
  const keyRaw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  const keyPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim() || '';
  const base64Raw = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  const googleAppCredPath =
    process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim() || '';

  const credentialSource = keyRaw
    ? 'FIREBASE_SERVICE_ACCOUNT_KEY'
    : keyPath
      ? 'FIREBASE_SERVICE_ACCOUNT_PATH'
      : base64Raw
        ? 'FIREBASE_SERVICE_ACCOUNT_BASE64'
        : googleAppCredPath
          ? 'GOOGLE_APPLICATION_CREDENTIALS'
          : 'none';

  const serviceAccountProjectId =
    extractProjectIdFromServiceAccount(keyRaw) ??
    extractProjectIdFromServiceAccount(decodeBase64Utf8(base64Raw));
  const bucketProjectId = extractProjectIdFromBucket(bucketName);
  const projectIdStatus = serviceAccountProjectId
    ? serviceAccountProjectId === bucketProjectId
      ? 'match'
      : bucketProjectId
        ? 'mismatch'
        : 'serviceAccountOnly'
    : bucketProjectId
      ? 'bucketOnly'
      : 'unknown';

  bootstrapLogger.log(
    `[startup] firebase/gcp bucketSet=${Boolean(bucketName)} bucket=${bucketName || '-'} credentialSource=${credentialSource} keyPathSet=${Boolean(keyPath)} googleApplicationCredentialsSet=${Boolean(googleAppCredPath)} serviceAccountProjectId=${serviceAccountProjectId ?? '-'} bucketProjectId=${bucketProjectId ?? '-'} projectIdStatus=${projectIdStatus}`,
  );

  if (!bucketName || credentialSource === 'none') {
    bootstrapLogger.warn(
      '[startup] firebase upload may fail: FIREBASE_STORAGE_BUCKET or Firebase service account env is missing',
    );
  }

  if (
    serviceAccountProjectId &&
    bucketProjectId &&
    serviceAccountProjectId !== bucketProjectId
  ) {
    bootstrapLogger.warn(
      '[startup] firebase project mismatch: service account project_id and storage bucket project prefix differ',
    );
  }
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function bootstrap() {
  logGcpIntegrationStatus();

  const app = await NestFactory.create(AppModule);
  app.enableCors();

  const port = Number(process.env.PORT ?? 9000);
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
