import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getStorage, Storage } from 'firebase-admin/storage';

type UploadTarget = 'products' | 'videos' | 'terms' | 'recipes';

type UploadedAssetFile = {
  buffer: Buffer;
  size: number;
  originalname: string;
  mimetype: string;
};

type PresignedUploadSession = {
  uploadUrl: string;
  objectPath: string;
  downloadToken: string;
};

const RESUMABLE_UPLOAD_MIN_BYTES = 8 * 1024 * 1024;
const LOCAL_FIREBASE_SERVICE_ACCOUNT_FILE = 'firebase-service-account.local.json';

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);
  private storage: Storage | null = null;
  private bucketName: string | null = null;

  constructor() {
    // lazy init - 키 값이 없어도 앱은 정상 부팅되고, 업로드 호출 시점에 초기화한다.
  }

  // Storage 를 지연 초기화한다. 키 값이 없거나 잘못된 경우 호출 시점에 에러를 던진다.
  private ensureStorage(): { storage: Storage; bucketName: string } {
    if (this.storage && this.bucketName) {
      this.logger.log(
        `[upload] reuse initialized storage bucket=${this.bucketName}`,
      );
      return { storage: this.storage, bucketName: this.bucketName };
    }

    const bucketName = process.env.FIREBASE_STORAGE_BUCKET?.trim();
    if (!bucketName) {
      this.logger.error('[upload] missing FIREBASE_STORAGE_BUCKET');
      throw new InternalServerErrorException(
        'FIREBASE_STORAGE_BUCKET 값이 필요합니다.',
      );
    }

    const app =
      getApps()[0] ??
      initializeApp({
        credential: this.resolveCredential(),
        storageBucket: bucketName,
      });

    this.bucketName = bucketName;
    this.storage = getStorage(app);
    this.logger.log(`[upload] initialized storage bucket=${bucketName}`);
    return { storage: this.storage, bucketName };
  }

  async uploadAsset(
    file: UploadedAssetFile,
    target: UploadTarget,
    productId?: string,
  ): Promise<string> {
    const startedAt = Date.now();
    if (!file || !file.buffer || file.size === 0) {
      throw new BadRequestException('업로드 파일이 필요합니다.');
    }

    const { storage, bucketName } = this.ensureStorage();

    const extension = this.getExtension(file.originalname);
    const timestamp = Date.now();
    const objectPath =
      target === 'videos'
        ? `info/video/${timestamp}.${extension}`
        : target === 'terms'
          ? `info/terms/${timestamp}.${extension}`
          : target === 'recipes'
            ? `info/recipes/${timestamp}.${extension}`
            : `product/${this.normalizeProductId(productId)}/${timestamp}.${extension}`;
    const downloadToken = randomUUID();
    const bucket = storage.bucket(bucketName);
    const uploaded = bucket.file(objectPath);
    const useResumable =
      target === 'videos' ||
      file.size >= RESUMABLE_UPLOAD_MIN_BYTES ||
      file.mimetype.startsWith('video/');
    this.logger.log(
      `[upload] upload start target=${target} productId=${productId ?? '-'} path=${objectPath} file=${file.originalname} size=${file.size} mime=${file.mimetype || '-'} resumable=${useResumable}`,
    );

    try {
      await uploaded.save(file.buffer, {
        resumable: useResumable,
        metadata: {
          contentType: file.mimetype || undefined,
          metadata: {
            firebaseStorageDownloadTokens: downloadToken,
          },
        },
      });

      this.logger.log(
        `[upload] upload done target=${target} path=${objectPath} elapsedMs=${Date.now() - startedAt}`,
      );
    } catch (error) {
      const message = this.getErrorMessage(error);

      this.logger.error(
        `[upload] upload failed target=${target} path=${objectPath} elapsedMs=${Date.now() - startedAt} message=${message}`,
      );

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

    return this.buildFirebaseDownloadUrl(bucketName, objectPath, downloadToken);
  }

  async createPresignedUploadSession(
    fileName: string,
    target: UploadTarget,
    productId?: string,
    contentType?: string,
  ): Promise<PresignedUploadSession> {
    const { storage, bucketName } = this.ensureStorage();
    const extension = this.getExtension(fileName);
    const timestamp = Date.now();
    const objectPath =
      target === 'videos'
        ? `info/video/${timestamp}.${extension}`
        : target === 'terms'
          ? `info/terms/${timestamp}.${extension}`
          : target === 'recipes'
            ? `info/recipes/${timestamp}.${extension}`
            : `product/${this.normalizeProductId(productId)}/${timestamp}.${extension}`;
    const downloadToken = randomUUID();

    const uploaded = storage.bucket(bucketName).file(objectPath);
    const [uploadUrl] = await uploaded.getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + 15 * 60 * 1000,
      contentType: contentType || 'application/octet-stream',
    });

    this.logger.log(
      `[upload] presign created target=${target} productId=${productId ?? '-'} path=${objectPath}`,
    );

    return {
      uploadUrl,
      objectPath,
      downloadToken,
    };
  }

  async completePresignedUpload(
    target: UploadTarget,
    objectPath: string,
    downloadToken: string,
    contentType?: string,
  ): Promise<string> {
    const { storage, bucketName } = this.ensureStorage();
    const normalizedPath = objectPath.trim();
    if (!this.isPathAllowedForTarget(target, normalizedPath)) {
      throw new BadRequestException('업로드 경로가 대상 타입과 일치하지 않습니다.');
    }

    const file = storage.bucket(bucketName).file(normalizedPath);
    await file.setMetadata({
      contentType: contentType || undefined,
      metadata: {
        firebaseStorageDownloadTokens: downloadToken,
      },
    });

    this.logger.log(
      `[upload] presign complete target=${target} path=${normalizedPath}`,
    );

    return this.buildFirebaseDownloadUrl(bucketName, normalizedPath, downloadToken);
  }

  private buildFirebaseDownloadUrl(
    bucketName: string,
    objectPath: string,
    downloadToken: string,
  ): string {
    return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(objectPath)}?alt=media&token=${downloadToken}`;
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return '업로드 처리 중 오류가 발생했습니다.';
  }

  private resolveCredential() {
    const serviceAccountEnv = this.getNonEmptyEnv('FIREBASE_SERVICE_ACCOUNT_KEY');
    const serviceAccountBase64 = this.getNonEmptyEnv('FIREBASE_SERVICE_ACCOUNT_BASE64');

    const serviceAccountFromFile =
      this.readServiceAccountFromFile(process.env.FIREBASE_SERVICE_ACCOUNT_PATH, true) ??
      this.readServiceAccountFromFile(LOCAL_FIREBASE_SERVICE_ACCOUNT_FILE, false);

    const serviceAccountRaw =
      serviceAccountEnv ??
      serviceAccountFromFile ??
      this.decodeBase64(serviceAccountBase64);

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

  private readServiceAccountFromFile(filePath?: string, strict = true): string | null {
    const trimmed = filePath?.trim();
    if (!trimmed) {
      return null;
    }

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
        return readFileSync(candidate, 'utf8');
      } catch {
        // Try the next candidate path.
      }
    }

    if (strict) {
      throw new InternalServerErrorException(
        'FIREBASE_SERVICE_ACCOUNT_PATH 파일을 읽을 수 없습니다.',
      );
    }

    return null;
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

  private getNonEmptyEnv(key: string): string | undefined {
    const value = process.env[key]?.trim();
    return value ? value : undefined;
  }

  private getExtension(fileName: string): string {
    const ext = fileName.split('.').pop()?.trim().toLowerCase();
    return ext || 'bin';
  }

  private isPathAllowedForTarget(target: UploadTarget, objectPath: string): boolean {
    if (target === 'videos') {
      return objectPath.startsWith('info/video/');
    }

    if (target === 'terms') {
      return objectPath.startsWith('info/terms/');
    }

    if (target === 'recipes') {
      return objectPath.startsWith('info/recipes/');
    }

    return objectPath.startsWith('product/');
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
