import { Injectable, Logger } from '@nestjs/common';
import { getApps, initializeApp, cert, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { readFileSync } from 'node:fs';

export type TriggerType = 'orders' | 'inquiries' | 'reviews';

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
    const serviceAccountRaw =
      process.env.FIREBASE_SERVICE_ACCOUNT_KEY ??
      this.readServiceAccountFromFile(process.env.FIREBASE_SERVICE_ACCOUNT_PATH) ??
      this.decodeBase64(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64);

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
    if (!filePath) return null;
    try {
      return readFileSync(filePath, 'utf-8');
    } catch {
      return null;
    }
  }

  private decodeBase64(encoded?: string): string | null {
    if (!encoded) return null;
    try {
      return Buffer.from(encoded, 'base64').toString('utf-8');
    } catch {
      return null;
    }
  }

  private extractProjectId(): string | null {
    // FIREBASE_STORAGE_BUCKET=corn-fbaae.firebasestorage.app → project ID = corn-fbaae
    const bucket = process.env.FIREBASE_STORAGE_BUCKET?.trim();
    if (!bucket) return null;
    const match = bucket.match(/^([^.]+)\./);
    return match?.[1] ?? null;
  }
}


