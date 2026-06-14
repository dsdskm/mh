import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getStorage, Storage } from 'firebase-admin/storage';

type UploadTarget = 'products' | 'videos';

type UploadedAssetFile = {
  buffer: Buffer;
  size: number;
  originalname: string;
  mimetype: string;
};

@Injectable()
export class UploadService {
  private readonly storage: Storage;
  private readonly bucketName: string;

  constructor() {
    const bucketName = process.env.FIREBASE_STORAGE_BUCKET?.trim();
    if (!bucketName) {
      throw new InternalServerErrorException(
        'FIREBASE_STORAGE_BUCKET 값이 필요합니다.',
      );
    }
    this.bucketName = bucketName;

    const app =
      getApps()[0] ??
      initializeApp({
        credential: this.resolveCredential(),
        storageBucket: this.bucketName,
      });

    this.storage = getStorage(app);
  }

  async uploadAsset(
    file: UploadedAssetFile,
    target: UploadTarget,
    productId?: string,
  ): Promise<string> {
    if (!file || !file.buffer || file.size === 0) {
      throw new BadRequestException('업로드 파일이 필요합니다.');
    }

    const extension = this.getExtension(file.originalname);
    const timestamp = Date.now();
    const objectPath =
      target === 'videos'
        ? `info/video/${timestamp}.${extension}`
        : `product/${this.normalizeProductId(productId)}/${timestamp}.${extension}`;
    const bucket = this.storage.bucket(this.bucketName);
    const uploaded = bucket.file(objectPath);

    try {
      await uploaded.save(file.buffer, {
        resumable: false,
        metadata: {
          contentType: file.mimetype || undefined,
        },
        public: true,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : '업로드 처리 중 오류가 발생했습니다.';
      if (
        message.includes('default credentials') ||
        message.includes('Could not load the default credentials')
      ) {
        throw new InternalServerErrorException(
          'Firebase 인증 정보가 없습니다. FIREBASE_SERVICE_ACCOUNT_KEY 또는 FIREBASE_SERVICE_ACCOUNT_BASE64를 설정해주세요.',
        );
      }

      throw new InternalServerErrorException(
        `업로드에 실패했습니다: ${message}`,
      );
    }

    return `https://storage.googleapis.com/${this.bucketName}/${objectPath}`;
  }

  private resolveCredential() {
    const serviceAccountRaw =
      process.env.FIREBASE_SERVICE_ACCOUNT_KEY ??
      this.readServiceAccountFromFile(
        process.env.FIREBASE_SERVICE_ACCOUNT_PATH,
      ) ??
      this.decodeBase64(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64);

    if (!serviceAccountRaw) {
      throw new InternalServerErrorException(
        'Firebase 인증 정보가 없습니다. FIREBASE_SERVICE_ACCOUNT_KEY, FIREBASE_SERVICE_ACCOUNT_BASE64, FIREBASE_SERVICE_ACCOUNT_PATH 중 하나를 설정해주세요.',
      );
    }

    try {
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
    } catch {
      throw new InternalServerErrorException(
        'FIREBASE_SERVICE_ACCOUNT_KEY 값이 유효한 JSON이 아닙니다.',
      );
    }
  }

  private readServiceAccountFromFile(filePath?: string): string | null {
    const trimmed = filePath?.trim();
    if (!trimmed) {
      return null;
    }

    try {
      return readFileSync(trimmed, 'utf8');
    } catch {
      throw new InternalServerErrorException(
        'FIREBASE_SERVICE_ACCOUNT_PATH 파일을 읽을 수 없습니다.',
      );
    }
  }

  private decodeBase64(value?: string): string | null {
    if (!value) {
      return null;
    }

    try {
      return Buffer.from(value, 'base64').toString('utf8');
    } catch {
      return null;
    }
  }

  private getExtension(fileName: string): string {
    const ext = fileName.split('.').pop()?.trim().toLowerCase();
    return ext || 'bin';
  }

  private normalizeProductId(productId?: string): string {
    const trimmed = (productId ?? '').trim();
    if (!trimmed) {
      return 'new';
    }

    const normalized = trimmed.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 80);
    return normalized || 'new';
  }
}
