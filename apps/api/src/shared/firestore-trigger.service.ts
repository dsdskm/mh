import { Injectable, Logger } from '@nestjs/common';
import { getApps, initializeApp, cert, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';

export type TriggerType = 'orders' | 'inquiries' | 'reviews';
const LOCAL_FIREBASE_SERVICE_ACCOUNT_FILE = 'firebase-service-account.local.json';

@Injectable()
export class FirestoreTriggerService {
  private readonly logger = new Logger(FirestoreTriggerService.name);
  private db: Firestore | null = null;
  private initAttempted = false;

  constructor() {
    // lazy init - notify() 호출 시 초기화 시도 (AdminUploadService 이후 Firebase 앱이 존재할 수 있음)
  }

  async notify(type: TriggerType): Promise<void> {
    if (!this.db) {
      this.db = this.initFirestore();
    }
    if (!this.db) return;
    try {
      await this.db.collection('admin-triggers').doc(type).set({
        type,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.warn(
        `Firestore trigger(${type}) failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private initFirestore(): Firestore | null {
    try {
      // 이미 초기화된 Firebase 앱 재사용 (AdminUploadService가 먼저 초기화했을 경우)
      let app: App | undefined = getApps()[0];
      if (!app) {
        const projectId = this.extractProjectId();
        app = initializeApp({
          credential: this.resolveCredential(),
          ...(projectId ? { projectId } : {}),
        });
      }
      return getFirestore(app);
    } catch (error) {
      this.logger.warn(
        `Firestore 초기화 실패 (실시간 알림 비활성): ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  private resolveCredential() {
    const serviceAccountEnv = this.getNonEmptyEnv('FIREBASE_SERVICE_ACCOUNT_KEY');
    const serviceAccountBase64 = this.getNonEmptyEnv('FIREBASE_SERVICE_ACCOUNT_BASE64');

    const serviceAccountRaw =
      serviceAccountEnv ??
      this.readServiceAccountFromFile(process.env.FIREBASE_SERVICE_ACCOUNT_PATH) ??
      this.readServiceAccountFromFile(LOCAL_FIREBASE_SERVICE_ACCOUNT_FILE) ??
      this.decodeBase64(serviceAccountBase64);

    if (!serviceAccountRaw) {
      throw new Error(
        'Firebase 인증 정보가 없습니다. FIREBASE_SERVICE_ACCOUNT_KEY, FIREBASE_SERVICE_ACCOUNT_BASE64, FIREBASE_SERVICE_ACCOUNT_PATH 중 하나를 설정해주세요.',
      );
    }

    const parsed = JSON.parse(serviceAccountRaw) as {
      project_id: string;
      client_email: string;
      private_key: string;
    };

    return cert({
      projectId: parsed.project_id,
      clientEmail: parsed.client_email,
      privateKey: parsed.private_key?.replace(/\\n/g, '\n'),
    });
  }

  private readServiceAccountFromFile(filePath?: string): string | null {
    const trimmed = filePath?.trim();
    if (!trimmed) return null;

    const candidates = isAbsolute(trimmed)
      ? [trimmed]
      : [
          trimmed,
          resolve(process.cwd(), trimmed),
          resolve(process.cwd(), '..', trimmed),
          resolve(process.cwd(), '..', '..', trimmed),
        ];

    for (const candidate of candidates) {
      try {
        return readFileSync(candidate, 'utf-8');
      } catch {
        // Try the next candidate path.
      }
    }

    return null;
  }

  private decodeBase64(encoded?: string): string | null {
    if (!encoded) return null;
    try {
      return Buffer.from(encoded, 'base64').toString('utf-8');
    } catch {
      return null;
    }
  }

  private getNonEmptyEnv(key: string): string | undefined {
    const value = process.env[key]?.trim();
    return value ? value : undefined;
  }

  private extractProjectId(): string | null {
    // FIREBASE_STORAGE_BUCKET=corn-fbaae.firebasestorage.app → project ID = corn-fbaae
    const bucket = process.env.FIREBASE_STORAGE_BUCKET?.trim();
    if (!bucket) return null;
    const match = bucket.match(/^([^.]+)\./);
    return match?.[1] ?? null;
  }
}


