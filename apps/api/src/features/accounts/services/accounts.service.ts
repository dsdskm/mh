import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { AccountRepository } from '../repositories/account.repository';
import type { AdminUserCreateInput, AdminUserUpdateInput, SharedUser } from '@repo/shared-types/user';
import type { AccountEntity } from '../../../database/entities/account.entity';
import { postKakaoAdminUserAction } from '../../../shared/kakao/kakao-admin.client';

@Injectable()
export class AccountsService {
  constructor(private readonly accountRepository: AccountRepository) {}

  async login(userId: string, password: string): Promise<boolean> {
    return userId.trim().toLowerCase() === 'master' && password === '5939';
  }

  async getAccounts(): Promise<SharedUser[]> {
    const accounts = await this.accountRepository.findAllAccountsDesc();
    return accounts.map((item) => this.toSharedUser(item));
  }

  async createAccount(input: AdminUserCreateInput): Promise<SharedUser> {
    const saved = await this.accountRepository.createAccount(input);
    return this.toSharedUser(saved);
  }

  async updateAccount(
    id: number,
    input: AdminUserUpdateInput,
  ): Promise<SharedUser | null> {
    const saved = await this.accountRepository.updateAccount(id, input);
    if (!saved) {
      return null;
    }

    return this.toSharedUser(saved);
  }

  async deleteAccount(id: number) {
    const account = await this.accountRepository.findAccountById(id);
    if (!account) {
      return false;
    }

    if (account.providerUserId) {
      await this.unlinkKakaoAccount(account);
    }

    return this.accountRepository.deleteAccount(id);
  }

  private toSharedUser(account: AccountEntity): SharedUser {
    const inferredType = account.userId?.trim().toLowerCase() === 'master'
      ? 'MASTER'
      : account.providerUserId
        ? 'KAKAO'
        : 'NORMAL';

    return {
      id: account.id,
      userId: account.userId,
      type: inferredType,
      username: account.username,
      providerUserId: account.providerUserId,
      displayName: account.displayName,
      phone: account.phone,
      address1: account.address1,
      address2: account.address2,
      status: account.status,
      statusReason: account.statusReason,
      isActive: account.isActive,
      termsAgreed: account.termsAgreed,
      createdAt: account.createdAt.toISOString(),
      updatedAt: account.updatedAt.toISOString(),
    };
  }

  private async unlinkKakaoAccount(account: AccountEntity): Promise<void> {
    const providerUserId = account.providerUserId?.trim() ?? '';
    if (!providerUserId) {
      throw new BadRequestException('카카오 providerUserId가 없어 계정 탈퇴를 진행할 수 없습니다.');
    }

    if (!/^\d+$/.test(providerUserId)) {
      throw new BadRequestException('카카오 providerUserId 형식이 올바르지 않아 계정 탈퇴를 진행할 수 없습니다.');
    }

    const kakaoAdminKey = process.env.KAKAO_ADMIN_KEY?.trim() ?? '';
    if (!kakaoAdminKey) {
      throw new InternalServerErrorException('KAKAO_ADMIN_KEY가 없어 카카오 탈퇴를 진행할 수 없습니다.');
    }

    const unlinkResult = await postKakaoAdminUserAction({
      action: 'unlink',
      providerUserId,
      kakaoAdminKey,
    });

    const unlinkData = unlinkResult.data;

    if (!unlinkResult.ok) {
      if (this.isAlreadyUnlinkedKakaoError(unlinkResult.status, unlinkData)) {
        console.info('[accounts] kakao already unlinked, continue delete', {
          accountId: account.id,
          userId: account.userId,
          providerUserId,
          status: unlinkResult.status,
          unlinkData,
        });
        return;
      }

      console.error('[accounts] kakao unlink failed before delete', {
        accountId: account.id,
        userId: account.userId,
        providerUserId,
        status: unlinkResult.status,
        unlinkData,
      });

      const kakaoDetail =
        unlinkData.msg?.trim() ||
        (typeof unlinkData.code === 'number' ? `Kakao code ${unlinkData.code}` : 'unknown error');
      throw new BadRequestException(
        `카카오 탈퇴 처리에 실패했습니다. (${kakaoDetail}) 관리자에게 문의해주세요.`,
      );
    }

    console.info('[accounts] kakao unlink success before delete', {
      accountId: account.id,
      userId: account.userId,
      providerUserId,
      unlinkData,
    });
  }

  private isAlreadyUnlinkedKakaoError(
    status: number,
    unlinkData: { msg?: string; code?: number },
  ): boolean {
    const normalizedMsg = (unlinkData.msg ?? '').toLowerCase();

    if (status === 404) {
      return true;
    }

    if (unlinkData.code === -101) {
      return true;
    }

    return (
      normalizedMsg.includes('already') && normalizedMsg.includes('unlinked')
    ) || normalizedMsg.includes('not registered user') || normalizedMsg.includes('this user does not exist');
  }
}
