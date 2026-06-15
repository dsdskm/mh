import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { MileageService } from '../services/mileage.service';

type AdjustMileageBody = {
  amount?: number;
  reason?: string;
};

@Controller('api')
export class MileageController {
  constructor(private readonly mileageService: MileageService) {}

  // 회원: 본인 적립금 잔액 + 내역
  @Get('mileage')
  getMemberMileage(@Query('accountId') accountId?: string) {
    return this.mileageService.getSummary(this.parseAccountId(accountId));
  }

  // 관리자: 특정 회원 적립금 잔액 + 내역
  @Get('backoffice/accounts/:id/mileage')
  getAccountMileage(@Param('id') id: string) {
    return this.mileageService.getSummary(this.parseAccountId(id));
  }

  // 관리자: 수동 지급/차감
  @Post('backoffice/accounts/:id/mileage')
  adjustMileage(@Param('id') id: string, @Body() body: AdjustMileageBody) {
    const amount = Math.floor(Number(body.amount) || 0);
    if (amount === 0) {
      throw new BadRequestException('변동 금액(amount)을 입력해주세요.');
    }
    return this.mileageService.adjust(this.parseAccountId(id), amount, body.reason);
  }

  private parseAccountId(value?: string): number {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new BadRequestException('accountId가 올바르지 않습니다.');
    }
    return parsed;
  }
}
