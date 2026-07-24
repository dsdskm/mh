import { Injectable, Logger } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';

type AdminTokenPayload = {
  sub: string;
  iat: number;
  exp: number;
};

@Injectable()
export class AdminAuthService {
  private readonly logger = new Logger(AdminAuthService.name);
  private readonly ttlSeconds = 60 * 60 * 8;
  private readonly secret: string;

  constructor() {
    const configured = process.env.ADMIN_AUTH_SECRET?.trim();

    if (configured) {
      this.secret = configured;
      return;
    }

    if (process.env.NODE_ENV === 'production') {
      throw new Error('ADMIN_AUTH_SECRET environment variable is required in production.');
    }

    this.secret = 'dev-admin-auth-secret-change-me';
    this.logger.warn('ADMIN_AUTH_SECRET is not set. Using an insecure development fallback secret.');
  }

  createToken(subject: string) {
    const issuedAt = Math.floor(Date.now() / 1000);
    const expiresAt = issuedAt + this.ttlSeconds;
    const payload: AdminTokenPayload = {
      sub: subject,
      iat: issuedAt,
      exp: expiresAt,
    };

    const encodedPayload = this.encodeBase64Url(JSON.stringify(payload));
    const signature = this.sign(encodedPayload);
    const token = `${encodedPayload}.${signature}`;

    return {
      token,
      expiresAt,
      expiresIn: this.ttlSeconds,
    };
  }

  verifyToken(token: string): AdminTokenPayload | null {
    const [encodedPayload, signature] = token.split('.');

    if (!encodedPayload || !signature) {
      return null;
    }

    const expectedSignature = this.sign(encodedPayload);
    if (!this.safeEquals(signature, expectedSignature)) {
      return null;
    }

    try {
      const payloadText = this.decodeBase64Url(encodedPayload);
      const payload = JSON.parse(payloadText) as Partial<AdminTokenPayload>;

      if (
        typeof payload.sub !== 'string' ||
        typeof payload.iat !== 'number' ||
        typeof payload.exp !== 'number'
      ) {
        return null;
      }

      const now = Math.floor(Date.now() / 1000);
      if (payload.exp <= now) {
        return null;
      }

      return {
        sub: payload.sub,
        iat: payload.iat,
        exp: payload.exp,
      };
    } catch {
      return null;
    }
  }

  private sign(value: string): string {
    const digest = createHmac('sha256', this.secret).update(value).digest('base64url');
    return digest;
  }

  private safeEquals(left: string, right: string): boolean {
    const leftBuf = Buffer.from(left);
    const rightBuf = Buffer.from(right);

    if (leftBuf.length !== rightBuf.length) {
      return false;
    }

    return timingSafeEqual(leftBuf, rightBuf);
  }

  private encodeBase64Url(value: string): string {
    return Buffer.from(value, 'utf-8').toString('base64url');
  }

  private decodeBase64Url(value: string): string {
    return Buffer.from(value, 'base64url').toString('utf-8');
  }
}