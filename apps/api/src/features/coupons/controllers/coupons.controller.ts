import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { CouponsService } from '../services/coupons.service';
import type { IssueCouponInput } from '@repo/shared-types/coupon';

type IssueCouponBody = Partial<IssueCouponInput>;

@Controller('api')
export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  // 회원: 사용 가능한 쿠폰 목록
  @Get('coupons')
  getMemberCoupons(@Query('accountId') accountId?: string) {
    const parsed = Number(accountId);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new BadRequestException('accountId가 올바르지 않습니다.');
    }
    return this.couponsService.listAvailableByAccount(parsed);
  }

  // 관리자: 전체 쿠폰 목록
  @Get('backoffice/coupons')
  getCoupons() {
    return this.couponsService.listAll();
  }

  // 관리자: 쿠폰 지급
  @Post('backoffice/coupons')
  issueCoupons(@Body() body: IssueCouponBody) {
    const accountIds = body.accountIds;
    const validTarget =
      accountIds === 'all' ||
      (Array.isArray(accountIds) && accountIds.length > 0);
    if (!validTarget) {
      throw new BadRequestException('지급 대상(accountIds)을 지정해주세요.');
    }
    if (!body.discountType) {
      throw new BadRequestException('할인 유형(discountType)이 필요합니다.');
    }

    return this.couponsService.issueCoupons({
      accountIds: accountIds as number[] | 'all',
      name: body.name ?? '',
      discountType: body.discountType,
      discountValue: Number(body.discountValue) || 0,
      minOrderAmount: body.minOrderAmount,
      maxDiscountAmount: body.maxDiscountAmount ?? null,
      validUntil: body.validUntil ?? null,
    });
  }

  // 관리자: 쿠폰 회수
  @Delete('backoffice/coupons/:id')
  async revokeCoupon(@Param('id') id: string) {
    const parsed = Number(id);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new BadRequestException('쿠폰 id가 올바르지 않습니다.');
    }
    await this.couponsService.revoke(parsed);
    return { ok: true };
  }
}
