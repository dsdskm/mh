import { Injectable, NotFoundException } from '@nestjs/common';
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
}
