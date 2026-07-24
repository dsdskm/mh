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
import type {
  CreateCouponTemplateInput,
  IssueCouponByTemplateInput,
  IssueCouponInput,
} from '@repo/shared-types/coupon';

type IssueCouponBody = Partial<IssueCouponInput>;
type CreateCouponTemplateBody = Partial<CreateCouponTemplateInput>;
type IssueCouponByTemplateBody = Partial<IssueCouponByTemplateInput>;

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

  // 관리자: 생성된 쿠폰 템플릿 목록
  @Get('backoffice/coupon-templates')
  getCouponTemplates() {
    return this.couponsService.listTemplates();
  }

  // 관리자: 쿠폰 템플릿 생성
  @Post('backoffice/coupon-templates')
  createCouponTemplate(@Body() body: CreateCouponTemplateBody) {
    if (!body.discountType) {
      throw new BadRequestException('할인 유형(discountType)이 필요합니다.');
    }

    return this.couponsService.createTemplate({
      name: body.name ?? '',
      usage: body.usage === 'signup' ? 'signup' : 'general',
      discountType: body.discountType,
      discountValue: Number(body.discountValue) || 0,
      minOrderAmount: body.minOrderAmount,
      maxDiscountAmount: body.maxDiscountAmount ?? null,
      validUntil: body.validUntil ?? null,
    });
  }

  // 관리자: 쿠폰 템플릿으로 지급
  @Post('backoffice/coupons/issue')
  issueCouponsByTemplate(@Body() body: IssueCouponByTemplateBody) {
    const accountIds = body.accountIds;
    const validTarget =
      accountIds === 'all' ||
      (Array.isArray(accountIds) && accountIds.length > 0);
    if (!validTarget) {
      throw new BadRequestException('지급 대상(accountIds)을 지정해주세요.');
    }

    return this.couponsService.issueCouponsByTemplate({
      couponTemplateId: Number(body.couponTemplateId),
      accountIds: accountIds as number[] | 'all',
    });
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

  // 관리자: 쿠폰 템플릿 삭제
  @Delete('backoffice/coupon-templates/:id')
  async deleteCouponTemplate(@Param('id') id: string) {
    const parsed = Number(id);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new BadRequestException('쿠폰 템플릿 id가 올바르지 않습니다.');
    }
    await this.couponsService.deleteTemplate(parsed);
    return { ok: true };
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
