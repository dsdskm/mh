import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import { AdminAuthService } from './admin-auth.service';

@Injectable()
export class BackofficeAuthGuard implements CanActivate {
  constructor(private readonly adminAuthService: AdminAuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const requestPath = request.path || request.url || '';

    if (request.method === 'OPTIONS') {
      return true;
    }

    if (!requestPath.startsWith('/api/backoffice')) {
      return true;
    }

    if (requestPath === '/api/backoffice/login') {
      return true;
    }

    if (
      requestPath.startsWith('/api/backoffice/database-sync') &&
      this.hasValidDatabaseSyncSecret(request)
    ) {
      return true;
    }

    const authorization = request.headers.authorization;
    const token = this.extractBearerToken(authorization);

    if (!token) {
      throw new UnauthorizedException('관리자 인증 토큰이 필요합니다.');
    }

    const payload = this.adminAuthService.verifyToken(token);
    if (!payload) {
      throw new UnauthorizedException(
        '관리자 인증이 유효하지 않습니다. 다시 로그인해주세요.',
      );
    }

    return true;
  }

  private extractBearerToken(authorizationHeader?: string): string | null {
    if (!authorizationHeader) {
      return null;
    }

    const [type, token] = authorizationHeader.split(' ');

    if (type?.toLowerCase() !== 'bearer' || !token) {
      return null;
    }

    return token.trim() || null;
  }

  private hasValidDatabaseSyncSecret(request: Request): boolean {
    const configuredSecret = process.env.ADMIN_AUTH_SECRET?.trim() || '';
    const providedHeader = request.headers['x-database-sync-secret'];
    const providedSecret = Array.isArray(providedHeader)
      ? providedHeader[0]?.trim()
      : providedHeader?.trim();

    if (!configuredSecret || !providedSecret) {
      return false;
    }

    const configuredBuffer = Buffer.from(configuredSecret);
    const providedBuffer = Buffer.from(providedSecret);
    return (
      configuredBuffer.length === providedBuffer.length &&
      timingSafeEqual(configuredBuffer, providedBuffer)
    );
  }
}
