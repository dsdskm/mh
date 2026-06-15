import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { MileageTransactionEntity } from '../../../database/entities/mileage-transaction.entity';
import { AccountEntity } from '../../../database/entities/account.entity';
import type {
  MileageSummary,
  MileageTransaction,
} from '@repo/shared-types/mileage';

@Injectable()
export class MileageService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(MileageTransactionEntity)
    private readonly mileageRepository: Repository<MileageTransactionEntity>,
    @InjectRepository(AccountEntity)
    private readonly accountRepository: Repository<AccountEntity>,
  ) {}

  async getSummary(accountId: number): Promise<MileageSummary> {
    const account = await this.accountRepository.findOne({
      where: { id: accountId },
      select: { id: true, mileageBalance: true },
    });
    if (!account) {
      throw new NotFoundException('계정을 찾을 수 없습니다.');
    }

    const transactions = await this.mileageRepository.find({
      where: { accountId },
      order: { createdAt: 'DESC', id: 'DESC' },
    });

    return {
      accountId,
      balance: account.mileageBalance ?? 0,
      transactions: transactions.map((tx) => this.toTransaction(tx)),
    };
  }

  // 관리자 수동 지급/차감
  async adjust(
    accountId: number,
    amount: number,
    reason?: string | null,
  ): Promise<MileageSummary> {
    const delta = Math.floor(Number(amount) || 0);
    if (delta === 0) {
      throw new BadRequestException('변동 금액을 입력해주세요.');
    }

    await this.dataSource.transaction(async (manager) => {
      const accountRepo = manager.getRepository(AccountEntity);
      const mileageRepo = manager.getRepository(MileageTransactionEntity);

      const account = await accountRepo.findOne({ where: { id: accountId } });
      if (!account) {
        throw new NotFoundException('계정을 찾을 수 없습니다.');
      }

      const current = account.mileageBalance ?? 0;
      const next = current + delta;
      if (next < 0) {
        throw new BadRequestException('적립금 잔액보다 많이 차감할 수 없습니다.');
      }

      account.mileageBalance = next;
      await accountRepo.save(account);

      await mileageRepo.save(
        mileageRepo.create({
          accountId,
          amount: delta,
          type: delta > 0 ? 'admin_grant' : 'admin_deduct',
          orderId: null,
          reason: reason?.trim() || null,
          balanceAfter: next,
        }),
      );
    });

    return this.getSummary(accountId);
  }

  private toTransaction(tx: MileageTransactionEntity): MileageTransaction {
    return {
      id: tx.id,
      accountId: tx.accountId,
      amount: tx.amount,
      type: tx.type,
      orderId: tx.orderId ?? null,
      reason: tx.reason ?? null,
      balanceAfter: tx.balanceAfter,
      createdAt: tx.createdAt.toISOString(),
    };
  }
}
