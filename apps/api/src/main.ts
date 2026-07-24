import * as path from 'node:path';
import { existsSync } from 'node:fs';
import * as dotenv from 'dotenv';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { randomUUID } from 'node:crypto';
import { json, urlencoded, type NextFunction, type Request, type Response } from 'express';
import { AppModule } from './app.module';

const bootstrapLogger = new Logger('Bootstrap');

function loadEnvFiles() {
  const workspaceRoot = path.resolve(__dirname, '../../../');
  const envPath = path.join(workspaceRoot, '.env');
  const envPrdPath = path.join(workspaceRoot, '.env.prd');
  const isProduction = process.env.NODE_ENV === 'production';

  if (existsSync(envPath)) {
    dotenv.config({ path: envPath, override: true });
  }

  if (isProduction && existsSync(envPrdPath)) {
    dotenv.config({ path: envPrdPath, override: true });
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
  const keyPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim() || '';
  const credentialSource = keyPath ? 'FIREBASE_SERVICE_ACCOUNT_PATH' : 'none';
  const serviceAccountProjectId = null;
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
    `[startup] firebase/gcp bucketSet=${Boolean(bucketName)} bucket=${bucketName || '-'} credentialSource=${credentialSource} keyPathSet=${Boolean(keyPath)} serviceAccountProjectId=${serviceAccountProjectId ?? '-'} bucketProjectId=${bucketProjectId ?? '-'} projectIdStatus=${projectIdStatus}`,
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

  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.use((req: Request, res: Response, next: NextFunction) => {
    const requestId =
      (typeof req.headers['x-request-id'] === 'string' &&
        req.headers['x-request-id'].trim()) ||
      randomUUID();
    const startedAt = process.hrtime.bigint();
    const ip = req.ip || req.socket.remoteAddress || '-';

    res.setHeader('x-request-id', requestId);
    bootstrapLogger.log(
      `[api:req] id=${requestId} method=${req.method} path=${req.originalUrl} ip=${ip}`,
    );

    res.on('finish', () => {
      const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      const status = res.statusCode;
      const message =
        `[api:res] id=${requestId} method=${req.method} path=${req.originalUrl} status=${status} durationMs=${elapsedMs.toFixed(1)}`;

      if (status >= 500) {
        bootstrapLogger.error(message);
        return;
      }

      if (status >= 400) {
        bootstrapLogger.warn(message);
        return;
      }

      bootstrapLogger.log(message);
    });

    next();
  });
  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ extended: true, limit: '10mb' }));
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
