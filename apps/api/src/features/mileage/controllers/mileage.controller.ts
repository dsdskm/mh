import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
} from '@nestjs/common';
import { MileageService } from '../services/mileage.service';

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

  private parseAccountId(value?: string): number {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new BadRequestException('accountId가 올바르지 않습니다.');
    }
    return parsed;
  }
}
