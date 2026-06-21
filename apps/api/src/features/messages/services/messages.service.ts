import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PopbillSmsClient } from './popbill-sms.client';
import { Repository } from 'typeorm';
import { AdminSmsHistoryEntity } from '../../../database/entities/admin-sms-history.entity';

type SendSmsInput = {
  receiver: string;
  receiverName?: string;
  content: string;
  reserveDT?: string;
  adsYN?: boolean;
};

type FixedSmsConfig = {
  corpNum: string;
  sender: string;
  senderName?: string;
  userID?: string;
};

type GetAdminSmsHistoryInput = {
  page: number;
  pageSize: number;
  query?: string;
  dateFrom?: string;
  dateTo?: string;
};

@Injectable()
export class MessagesService {
  constructor(
    private readonly popbillSmsClient: PopbillSmsClient,
    @InjectRepository(AdminSmsHistoryEntity)
    private readonly adminSmsHistoryRepository: Repository<AdminSmsHistoryEntity>,
  ) {}

  async getAdminSmsHistory(input: GetAdminSmsHistoryInput) {
    const query = this.adminSmsHistoryRepository
      .createQueryBuilder('sms')
      .orderBy('sms.createdAt', 'DESC')
      .skip((input.page - 1) * input.pageSize)
      .take(input.pageSize);

    if (input.query) {
      query.andWhere(
        '(sms.receiver ILIKE :keyword OR sms.content ILIKE :keyword)',
        { keyword: `%${input.query}%` },
      );
    }

    if (input.dateFrom) {
      const from = new Date(input.dateFrom);
      if (Number.isNaN(from.getTime())) {
        throw new BadRequestException('dateFrom 값이 올바르지 않습니다.');
      }
      query.andWhere('sms.createdAt >= :dateFrom', { dateFrom: from.toISOString() });
    }

    if (input.dateTo) {
      const to = new Date(input.dateTo);
      if (Number.isNaN(to.getTime())) {
        throw new BadRequestException('dateTo 값이 올바르지 않습니다.');
      }
      query.andWhere('sms.createdAt <= :dateTo', { dateTo: to.toISOString() });
    }

    const [items, total] = await query.getManyAndCount();

    const totalPages = total > 0 ? Math.ceil(total / input.pageSize) : 1;

    return {
      page: input.page,
      pageSize: input.pageSize,
      total,
      totalPages,
      items: items.map((item) => ({
        id: item.id,
        createdAt: item.createdAt.toISOString(),
        corpNum: item.corpNum,
        sender: item.sender,
        senderName: item.senderName,
        userID: item.userID,
        receiver: item.receiver,
        receiverName: item.receiverName,
        content: item.content,
        reserveDT: item.reserveDT,
        adsYN: item.adsYN,
        receiptNum: item.receiptNum,
        status: item.status,
        errorMessage: item.errorMessage,
      })),
    };
  }

  async sendSms(input: SendSmsInput): Promise<{ receiptNum: string }> {
    const fixedConfig = this.getFixedSmsConfig();

    try {
      await this.popbillSmsClient.checkSenderNumber({
        corpNum: fixedConfig.corpNum,
        sender: fixedConfig.sender,
        userID: fixedConfig.userID,
      });
      console.info(
        `[POPBILL_SENDER_CHECK] ok corpNum=${fixedConfig.corpNum} sender=${fixedConfig.sender}`,
      );

      const receiptNum = await this.popbillSmsClient.sendSms({
        ...fixedConfig,
        ...input,
      });

      await this.adminSmsHistoryRepository.save(
        this.adminSmsHistoryRepository.create({
          corpNum: fixedConfig.corpNum,
          sender: fixedConfig.sender,
          senderName: fixedConfig.senderName ?? null,
          userID: fixedConfig.userID ?? null,
          receiver: input.receiver,
          receiverName: input.receiverName ?? null,
          content: input.content,
          reserveDT: input.reserveDT ?? null,
          adsYN: Boolean(input.adsYN),
          receiptNum,
          status: 'success',
          errorMessage: null,
        }),
      );

      return { receiptNum };
    } catch (error) {
      const message = error instanceof Error ? error.message : '문자 발송 중 알 수 없는 오류가 발생했습니다.';
      console.error(
        `[POPBILL_SENDER_CHECK] failed corpNum=${fixedConfig.corpNum} sender=${fixedConfig.sender} message=${message}`,
      );

      await this.adminSmsHistoryRepository.save(
        this.adminSmsHistoryRepository.create({
          corpNum: fixedConfig.corpNum,
          sender: fixedConfig.sender,
          senderName: fixedConfig.senderName ?? null,
          userID: fixedConfig.userID ?? null,
          receiver: input.receiver,
          receiverName: input.receiverName ?? null,
          content: input.content,
          reserveDT: input.reserveDT ?? null,
          adsYN: Boolean(input.adsYN),
          receiptNum: null,
          status: 'failed',
          errorMessage: message,
        }),
      );

      throw new BadRequestException(`문자 발송에 실패했습니다. ${message}`);
    }
  }

  async cancelReservedSms(input: { historyId: number }): Promise<{ ok: true }> {
    const history = await this.adminSmsHistoryRepository.findOne({ where: { id: input.historyId } });
    if (!history) {
      throw new BadRequestException('취소할 문자 내역을 찾을 수 없습니다.');
    }
    if (!history.reserveDT) {
      throw new BadRequestException('예약 문자가 아닙니다.');
    }
    if (!history.receiptNum) {
      throw new BadRequestException('접수번호가 없어 예약 취소를 진행할 수 없습니다.');
    }
    if (history.status === 'cancelled') {
      throw new BadRequestException('이미 취소된 예약 문자입니다.');
    }
    if (history.status === 'failed') {
      throw new BadRequestException('실패한 문자 내역은 취소할 수 없습니다.');
    }

    const fixedConfig = this.getFixedSmsConfig();

    try {
      await this.popbillSmsClient.cancelReserve({
        corpNum: fixedConfig.corpNum,
        receiptNum: history.receiptNum,
        userID: fixedConfig.userID,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '예약 취소 중 알 수 없는 오류가 발생했습니다.';
      throw new BadRequestException(`예약 취소에 실패했습니다. ${message}`);
    }

    history.status = 'cancelled';
    history.errorMessage = null;
    await this.adminSmsHistoryRepository.save(history);

    return { ok: true };
  }

  private getFixedSmsConfig(): FixedSmsConfig {
    const corpNum = (process.env.POPBILL_CORP_NUM ?? '').trim();
    const sender = (process.env.POPBILL_SENDER ?? '').replace(/\D/g, '');
    const senderName = (process.env.POPBILL_SENDER_NAME ?? '').trim();
    const userID = (process.env.POPBILL_USER_ID ?? '').trim();

    if (!/^\d{10}$/.test(corpNum)) {
      throw new BadRequestException('서버 설정 오류: POPBILL_CORP_NUM(숫자 10자리) 값을 확인해주세요.');
    }

    if (!/^\d{8,20}$/.test(sender)) {
      throw new BadRequestException('서버 설정 오류: POPBILL_SENDER(숫자 8~20자리) 값을 확인해주세요.');
    }

    if (senderName.length > 70) {
      throw new BadRequestException('서버 설정 오류: POPBILL_SENDER_NAME은 70자를 초과할 수 없습니다.');
    }

    if (userID.length > 50) {
      throw new BadRequestException('서버 설정 오류: POPBILL_USER_ID는 50자를 초과할 수 없습니다.');
    }

    return {
      corpNum,
      sender,
      senderName: senderName || undefined,
      userID: userID || undefined,
    };
  }
}
