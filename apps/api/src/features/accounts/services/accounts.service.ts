import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { AccountRepository } from '../repositories/account.repository';
import type { AdminUserCreateInput, AdminUserUpdateInput, SharedUser } from '@repo/shared-types/user';
import type { AccountEntity } from '../../../database/entities/account.entity';

@Injectable()
export class AccountsService {
  constructor(private readonly accountRepository: AccountRepository) {}

  async login(userId: string, password: string): Promise<boolean> {
    const matched = await this.accountRepository.findActiveAccountsByCredential(
      userId,
      password,
    );

    return matched.some((account) => account.type.toLowerCase() === 'master');
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

    if (account.type === 'KAKAO') {
      await this.unlinkKakaoAccount(account);
    }

    return this.accountRepository.deleteAccount(id);
  }

  async getAccountShippingAddresses(accountId: number) {
    const account = await this.accountRepository.findAccountById(accountId);
    if (!account) {
      throw new NotFoundException('계정을 찾을 수 없습니다.');
    }

    const addresses = await this.accountRepository.findShippingAddressesByAccountId(accountId);

    return {
      shippingAddresses: addresses.map((item) => ({
        id: item.id,
        name: item.name,
        address1: item.address1 ?? '',
        address2: item.address2 ?? '',
        isDefault: item.isDefault,
      })),
    };
  }

  private toSharedUser(account: AccountEntity): SharedUser {
    return {
      id: account.id,
      userId: account.userId,
      type: account.type,
      username: account.username,
      providerUserId: account.providerUserId,
      displayName: account.displayName,
      kakaoNickname: account.kakaoNickname,
      kakaoProfileImageUrl: account.kakaoProfileImageUrl,
      kakaoThumbnailImageUrl: account.kakaoThumbnailImageUrl,
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

    const unlinkBody = new URLSearchParams({
      target_id_type: 'user_id',
      target_id: providerUserId,
    });

    const unlinkResponse = await fetch('https://kapi.kakao.com/v1/user/unlink', {
      method: 'POST',
      headers: {
        Authorization: `KakaoAK ${kakaoAdminKey}`,
        'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
      },
      body: unlinkBody.toString(),
    });

    const unlinkData = (await unlinkResponse.json().catch(() => ({}))) as {
      id?: number;
      msg?: string;
      code?: number;
    };

    if (!unlinkResponse.ok) {
      if (this.isAlreadyUnlinkedKakaoError(unlinkResponse.status, unlinkData)) {
        console.info('[accounts] kakao already unlinked, continue delete', {
          accountId: account.id,
          userId: account.userId,
          providerUserId,
          status: unlinkResponse.status,
          unlinkData,
        });
        return;
      }

      console.error('[accounts] kakao unlink failed before delete', {
        accountId: account.id,
        userId: account.userId,
        providerUserId,
        status: unlinkResponse.status,
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
