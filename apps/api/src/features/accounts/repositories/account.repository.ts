import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccountEntity } from '../../../database/entities/account.entity';
import type { AdminUserCreateInput, AdminUserUpdateInput } from '@repo/shared-types/user';

@Injectable()
export class AccountRepository {
  constructor(
    @InjectRepository(AccountEntity)
    private readonly accountRepository: Repository<AccountEntity>,
  ) {}

  findMasterAccount(): Promise<AccountEntity | null> {
    return this.accountRepository.findOne({
      where: {
        userId: 'master',
      },
    });
  }

  findActiveAccountsByCredential(userId: string, password: string): Promise<AccountEntity[]> {
    return this.accountRepository.find({
      where: {
        userId,
        password,
        isActive: true,
      },
    });
  }

  findAllAccountsDesc(): Promise<AccountEntity[]> {
    return this.accountRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async createAccount(input: AdminUserCreateInput): Promise<AccountEntity> {
    const account = this.accountRepository.create({
      userId: input.userId ?? null,
      username: input.username ?? input.userId ?? null,
      password: input.password ?? null,
      providerUserId: input.providerUserId ?? null,
      email: null,
      displayName: input.displayName ?? null,
      phone: input.phone ?? null,
      address1: input.address1 ?? null,
      address2: input.address2 ?? null,
      status: input.status ?? 'active',
      statusReason: input.statusReason ?? null,
      isActive: input.isActive ?? true,
      termsAgreed: true,
      termsAgreedAt: new Date(),
    });

    return this.accountRepository.save(account);
  }

  async updateAccount(id: number, input: AdminUserUpdateInput): Promise<AccountEntity | null> {
    const account = await this.accountRepository.findOne({ where: { id } });
    if (!account) {
      return null;
    }

    Object.assign(account, {
      userId: input.userId !== undefined ? input.userId || null : account.userId,
      username: input.username !== undefined ? input.username || null : account.username,
      password: input.password !== undefined ? input.password || null : account.password,
      providerUserId:
        input.providerUserId !== undefined
          ? input.providerUserId || null
          : account.providerUserId,
      displayName:
        input.displayName !== undefined
          ? input.displayName || null
          : account.displayName,
      phone: input.phone !== undefined ? input.phone || null : account.phone,
      address1: input.address1 !== undefined ? input.address1 || null : account.address1,
      address2: input.address2 !== undefined ? input.address2 || null : account.address2,
      status: input.status ?? account.status,
      statusReason:
        input.statusReason !== undefined
          ? input.statusReason || null
          : account.statusReason,
      isActive: input.isActive ?? account.isActive,
    });

    return this.accountRepository.save(account);
  }

  async deleteAccount(id: number): Promise<boolean> {
    const result = await this.accountRepository.delete({ id });
    return (result.affected ?? 0) > 0;
  }

  findAccountById(id: number): Promise<AccountEntity | null> {
    return this.accountRepository.findOne({ where: { id } });
  }
}
