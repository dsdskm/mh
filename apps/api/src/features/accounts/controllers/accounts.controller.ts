import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  NotFoundException,
  Param,
  Patch,
  Post,
  UnauthorizedException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AccountsService } from '../services/accounts.service';
import { UploadService } from '../services/upload.service';
import type { AdminUserCreateInput, AdminUserUpdateInput } from '@repo/shared-types/user';
import { AdminAuthService } from '../../../shared/auth/admin-auth.service';

type LoginBody = {
  id?: string;
  userId?: string;
  password?: string;
};

type AccountBody = AdminUserCreateInput & AdminUserUpdateInput;

type PresignUploadBody = {
  target?: string;
  productId?: string;
  fileName?: string;
  contentType?: string;
};

type CompleteUploadBody = {
  target?: string;
  objectPath?: string;
  downloadToken?: string;
  contentType?: string;
};

@Controller('api/backoffice')
export class AccountsController {
  private readonly logger = new Logger(AccountsController.name);

  constructor(
    private readonly accountsService: AccountsService,
    private readonly uploadService: UploadService,
    private readonly adminAuthService: AdminAuthService,
  ) {}

  @Post('uploads/presign')
  async createUploadPresignedUrl(@Body() body: PresignUploadBody) {
    const target = (body.target ?? '').trim().toLowerCase();
    const fileName = (body.fileName ?? '').trim();
    const productId = body.productId?.trim();
    const contentType = body.contentType?.trim();

    if (target !== 'products' && target !== 'videos' && target !== 'terms' && target !== 'recipes') {
      throw new BadRequestException(
        'target은 products, videos, terms 또는 recipes 여야 합니다.',
      );
    }

    if (!fileName) {
      throw new BadRequestException('fileName이 필요합니다.');
    }

    const session = await this.uploadService.createPresignedUploadSession(
      fileName,
      target,
      productId,
      contentType,
    );

    return session;
  }

  @Post('uploads/complete')
  async completeUpload(@Body() body: CompleteUploadBody) {
    const target = (body.target ?? '').trim().toLowerCase();
    const objectPath = (body.objectPath ?? '').trim();
    const downloadToken = (body.downloadToken ?? '').trim();
    const contentType = body.contentType?.trim();

    if (target !== 'products' && target !== 'videos' && target !== 'terms' && target !== 'recipes') {
      throw new BadRequestException(
        'target은 products, videos, terms 또는 recipes 여야 합니다.',
      );
    }

    if (!objectPath || !downloadToken) {
      throw new BadRequestException('objectPath와 downloadToken이 필요합니다.');
    }

    const url = await this.uploadService.completePresignedUpload(
      target,
      objectPath,
      downloadToken,
      contentType,
    );

    return { url };
  }

  @Post('uploads')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: { buffer: Buffer; size: number; originalname: string; mimetype: string },
    @Body('target') targetRaw?: string,
    @Body('productId') productId?: string,
  ) {
    const startedAt = Date.now();
    const target = (targetRaw ?? '').trim().toLowerCase();
    this.logger.log(
      `[upload] request received target=${target || 'unknown'} productId=${productId ?? '-'} file=${file?.originalname ?? '-'} size=${file?.size ?? 0} mime=${file?.mimetype ?? '-'}`,
    );
    if (target !== 'products' && target !== 'videos' && target !== 'terms' && target !== 'recipes') {
      throw new BadRequestException(
        'target은 products, videos, terms 또는 recipes 여야 합니다.',
      );
    }

    const url = await this.uploadService.uploadAsset(file, target, productId);
    this.logger.log(
      `[upload] success target=${target} file=${file?.originalname ?? '-'} elapsedMs=${Date.now() - startedAt} url=${url}`,
    );
    return { url };
  }

  @Post('login')
  async login(@Body() body: LoginBody) {
    const userId = (body.userId ?? body.id)?.trim();
    const password = body.password?.trim();

    if (!userId || !password) {
      throw new BadRequestException('userId, password를 입력해주세요.');
    }

    const ok = await this.accountsService.login(userId, password);
    if (!ok) {
      throw new UnauthorizedException('아이디 또는 비밀번호가 올바르지 않습니다.');
    }

    const { token, expiresAt, expiresIn } = this.adminAuthService.createToken(userId);

    return {
      ok: true,
      accessToken: token,
      tokenType: 'Bearer',
      expiresAt,
      expiresIn,
    };
  }

  @Get('accounts')
  getAccounts() {
    return this.accountsService.getAccounts();
  }

  @Post('accounts')
  createAccount(@Body() body: AccountBody) {
    const type = this.parseAccountType(body.type);
    const status = this.parseAccountStatus(body.status);

    if (type === 'NORMAL' && (!body.userId?.trim() || !body.password?.trim())) {
      throw new BadRequestException(
        'NORMAL 계정은 userId, password가 필요합니다.',
      );
    }

    if (
      (type === 'KAKAO' || type === 'NAVER') &&
      !body.providerUserId?.trim()
    ) {
      throw new BadRequestException(
        `${type} 계정은 providerUserId가 필요합니다.`,
      );
    }

    return this.accountsService.createAccount({
      type,
      userId: body.userId?.trim(),
      username: body.username?.trim(),
      password: body.password?.trim(),
      providerUserId: body.providerUserId?.trim(),
      displayName: body.displayName?.trim(),
      phone: body.phone?.trim(),
      address1: body.address1?.trim(),
      address2: body.address2?.trim(),
      status,
      statusReason: body.statusReason?.trim(),
      isActive: body.isActive,
    });
  }

  @Patch('accounts/:id')
  async updateAccount(
    @Param('id') id: string,
    @Body() body: AccountBody,
  ) {
    const parsedId = Number(id);
    if (Number.isNaN(parsedId)) {
      throw new BadRequestException('계정 id가 올바르지 않습니다.');
    }

    const type = body.type ? this.parseAccountType(body.type) : undefined;
    const status = body.status ? this.parseAccountStatus(body.status) : undefined;

    const updated = await this.accountsService.updateAccount(parsedId, {
      type,
      userId: body.userId?.trim(),
      username: body.username?.trim(),
      password: body.password?.trim(),
      providerUserId: body.providerUserId?.trim(),
      displayName: body.displayName?.trim(),
      phone: body.phone?.trim(),
      address1: body.address1?.trim(),
      address2: body.address2?.trim(),
      status,
      statusReason: body.statusReason?.trim(),
      isActive: body.isActive,
    });

    if (!updated) {
      throw new NotFoundException('계정을 찾을 수 없습니다.');
    }

    return updated;
  }

  @Get('accounts/:id/shipping-addresses')
  async getAccountShippingAddresses(@Param('id') id: string) {
    const parsedId = Number(id);
    if (Number.isNaN(parsedId)) {
      throw new BadRequestException('계정 id가 올바르지 않습니다.');
    }
    return this.accountsService.getAccountShippingAddresses(parsedId);
  }

  @Delete('accounts/:id')
  async deleteAccount(@Param('id') id: string) {
    const parsedId = Number(id);
    if (Number.isNaN(parsedId)) {
      throw new BadRequestException('계정 id가 올바르지 않습니다.');
    }

    const deleted = await this.accountsService.deleteAccount(parsedId);
    if (!deleted) {
      throw new NotFoundException('계정을 찾을 수 없습니다.');
    }

    return { ok: true };
  }

  private parseAccountType(type: any): 'MASTER' | 'NORMAL' | 'KAKAO' | 'NAVER' {
    if (typeof type === 'string') {
      const upper = type.toUpperCase();
      if (['MASTER', 'NORMAL', 'KAKAO', 'NAVER'].includes(upper)) {
        return upper as 'MASTER' | 'NORMAL' | 'KAKAO' | 'NAVER';
      }
    }
    throw new BadRequestException('계정 타입이 올바르지 않습니다.');
  }

  private parseAccountStatus(status: any): 'active' | 'deactive' | 'withdraw' {
    if (typeof status === 'string') {
      const lower = status.toLowerCase();
      if (['active', 'deactive', 'withdraw'].includes(lower)) {
        return lower as 'active' | 'deactive' | 'withdraw';
      }
    }
    throw new BadRequestException('계정 상태가 올바르지 않습니다.');
  }
}
