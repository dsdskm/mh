import { BadRequestException, Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { MessagesService } from '../services/messages.service';

type SendSmsBody = {
  receiver?: string;
  receiverName?: string;
  content?: string;
  reserveDT?: string;
  adsYN?: boolean;
};

const DIRECT_SMS_MAX_CHARS = 45;

@Controller('api/backoffice/messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get('history')
  async getHistory(
    @Query('page') pageRaw?: string,
    @Query('pageSize') pageSizeRaw?: string,
    @Query('q') queryRaw?: string,
    @Query('dateFrom') dateFromRaw?: string,
    @Query('dateTo') dateToRaw?: string,
  ) {
    const page = Number(pageRaw);
    const pageSize = Number(pageSizeRaw);

    const safePage = Number.isInteger(page) && page > 0 ? page : 1;
    const safePageSize = Number.isInteger(pageSize) && pageSize > 0 ? pageSize : 10;

    return this.messagesService.getAdminSmsHistory({
      page: safePage,
      pageSize: Math.min(safePageSize, 100),
      query: queryRaw?.trim() || undefined,
      dateFrom: dateFromRaw?.trim() || undefined,
      dateTo: dateToRaw?.trim() || undefined,
    });
  }

  @Post('sms')
  async sendSms(@Body() body: SendSmsBody) {
    const receiver = this.normalizePhone(body.receiver);
    const receiverName = body.receiverName?.trim() || '';
    const content = (body.content ?? '').trim();
    const reserveDT = body.reserveDT?.trim() || '';
    const adsYN = Boolean(body.adsYN);

    if (!this.isValidPhone(receiver)) {
      throw new BadRequestException('receiver는 유효한 수신번호(숫자 8~20자리)여야 합니다.');
    }
    if (!content) {
      throw new BadRequestException('content를 입력해주세요.');
    }
    if (this.smsCharLength(content) > DIRECT_SMS_MAX_CHARS) {
      throw new BadRequestException(`content는 ${DIRECT_SMS_MAX_CHARS}자를 초과할 수 없습니다.`);
    }
    if (receiverName.length > 70) {
      throw new BadRequestException('receiverName은 70자를 초과할 수 없습니다.');
    }
    if (reserveDT && !/^\d{14}$/.test(reserveDT)) {
      throw new BadRequestException('reserveDT 형식은 yyyyMMddHHmmss 입니다.');
    }

    return this.messagesService.sendSms({
      receiver,
      receiverName,
      content,
      reserveDT,
      adsYN,
    });
  }

  @Post('reservations/:historyId/cancel')
  async cancelReservation(@Param('historyId') historyIdRaw: string) {
    const historyId = Number(historyIdRaw);
    if (!Number.isInteger(historyId) || historyId <= 0) {
      throw new BadRequestException('historyId는 1 이상의 정수여야 합니다.');
    }

    return this.messagesService.cancelReservedSms({ historyId });
  }

  private normalizePhone(value?: string): string {
    return (value ?? '').replace(/\D/g, '');
  }

  private isValidPhone(value: string): boolean {
    return /^\d{8,20}$/.test(value);
  }

  private smsCharLength(content: string): number {
    return Array.from(content).length;
  }
}
