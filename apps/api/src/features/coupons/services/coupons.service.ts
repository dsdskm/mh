import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';
import { CouponEntity } from '../../../database/entities/coupon.entity';
import { AccountEntity } from '../../../database/entities/account.entity';
import type { Coupon, IssueCouponInput } from '@repo/shared-types/coupon';
import { isCouponExpired } from '../coupon.util';

@Injectable()
export class CouponsService {
  constructor(
    @InjectRepository(CouponEntity)
    private readonly couponRepository: Repository<CouponEntity>,
    @InjectRepository(AccountEntity)
    private readonly accountRepository: Repository<AccountEntity>,
  ) {}

  // 관리자: 쿠폰 지급 (특정 회원 목록 또는 전체 회원)
  async issueCoupons(input: IssueCouponInput): Promise<{ issued: number }> {
    const name = input.name?.trim();
    if (!name) {
      throw new BadRequestException('쿠폰 이름을 입력해주세요.');
    }

    if (input.discountType !== 'fixed' && input.discountType !== 'percent') {
      throw new BadRequestException('할인 유형이 올바르지 않습니다.');
    }

    const discountValue = Math.floor(Number(input.discountValue) || 0);
    if (discountValue <= 0) {
      throw new BadRequestException('할인 값은 1 이상이어야 합니다.');
    }
    if (input.discountType === 'percent' && discountValue > 100) {
      throw new BadRequestException('정률 할인은 100% 를 넘을 수 없습니다.');
    }

    const minOrderAmount = Math.max(0, Math.floor(Number(input.minOrderAmount) || 0));
    const maxDiscountAmount =
      input.maxDiscountAmount == null
        ? null
        : Math.max(0, Math.floor(Number(input.maxDiscountAmount) || 0)) || null;

    let validUntil: Date | null = null;
    if (input.validUntil) {
      const parsed = new Date(input.validUntil);
      if (Number.isNaN(parsed.getTime())) {
        throw new BadRequestException('유효기한 형식이 올바르지 않습니다.');
      }
      validUntil = parsed;
    }

    const accountIds = await this.resolveTargetAccountIds(input.accountIds);
    if (accountIds.length === 0) {
      throw new BadRequestException('지급 대상 회원이 없습니다.');
    }

    const rows = accountIds.map((accountId) =>
      this.couponRepository.create({
        accountId,
        name,
        discountType: input.discountType,
        discountValue,
        minOrderAmount,
        maxDiscountAmount,
        validUntil,
        status: 'available',
      }),
    );

    await this.couponRepository.save(rows);
    return { issued: rows.length };
  }

  // 관리자: 전체 쿠폰 목록 (보유 회원 이름 포함)
  async listAll(): Promise<Coupon[]> {
    const coupons = await this.couponRepository.find({
      order: { issuedAt: 'DESC' },
    });

    const accountMap = await this.loadAccountNameMap(
      coupons.map((c) => c.accountId),
    );

    return coupons.map((coupon) =>
      this.toCoupon(coupon, accountMap.get(coupon.accountId) ?? null),
    );
  }

  // 회원: 사용 가능한 쿠폰 (available + 미만료)
  async listAvailableByAccount(accountId: number): Promise<Coupon[]> {
    const coupons = await this.couponRepository.find({
      where: { accountId, status: 'available' },
      order: { issuedAt: 'DESC' },
    });

    const now = new Date();
    return coupons
      .filter((coupon) => !isCouponExpired(coupon.validUntil, now))
      .map((coupon) => this.toCoupon(coupon, null));
  }

  async revoke(id: number): Promise<void> {
    const coupon = await this.couponRepository.findOne({ where: { id } });
    if (!coupon) {
      throw new NotFoundException('쿠폰을 찾을 수 없습니다.');
    }
    if (coupon.status === 'used') {
      throw new BadRequestException('이미 사용된 쿠폰은 회수할 수 없습니다.');
    }
    coupon.status = 'revoked';
    await this.couponRepository.save(coupon);
  }

  private async resolveTargetAccountIds(
    accountIds: number[] | 'all',
  ): Promise<number[]> {
    if (accountIds === 'all') {
      const accounts = await this.accountRepository.find({
        where: { isActive: true, type: Not('MASTER') },
        select: { id: true },
      });
      return accounts.map((a) => a.id);
    }

    if (!Array.isArray(accountIds) || accountIds.length === 0) {
      return [];
    }

    const ids = [...new Set(accountIds.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))];
    const accounts = await this.accountRepository.find({
      where: { id: In(ids) },
      select: { id: true },
    });
    return accounts.map((a) => a.id);
  }

  private async loadAccountNameMap(
    accountIds: number[],
  ): Promise<Map<number, string | null>> {
    const uniqueIds = [...new Set(accountIds)];
    if (uniqueIds.length === 0) {
      return new Map();
    }
    const accounts = await this.accountRepository.find({
      where: { id: In(uniqueIds) },
      select: { id: true, displayName: true, userId: true },
    });
    return new Map(
      accounts.map((a) => [a.id, a.displayName ?? a.userId ?? null]),
    );
  }

  private toCoupon(coupon: CouponEntity, accountName: string | null): Coupon {
    return {
      id: coupon.id,
      accountId: coupon.accountId,
      name: coupon.name,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      minOrderAmount: coupon.minOrderAmount ?? 0,
      maxDiscountAmount: coupon.maxDiscountAmount ?? null,
      validUntil: coupon.validUntil ? coupon.validUntil.toISOString() : null,
      status: coupon.status,
      usedOrderId: coupon.usedOrderId ?? null,
      usedAt: coupon.usedAt ? coupon.usedAt.toISOString() : null,
      issuedAt: coupon.issuedAt.toISOString(),
      accountName,
      expired: isCouponExpired(coupon.validUntil),
    };
  }
}
