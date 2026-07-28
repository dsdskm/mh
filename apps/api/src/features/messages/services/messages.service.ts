import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PopbillSmsClient } from './popbill-sms.client';
import { SolapiMessageClient } from './solapi-message.client';
import { KAKAO_TEMPLATE_IDS, SOLAPI_PF_ID } from './kakao-template.constants';
import { Repository } from 'typeorm';
import { AdminMessageChannel, AdminSmsHistoryEntity, AdminSmsStatus } from '../../../database/entities/admin-sms-history.entity';
import { ConfigService } from '../../config/services/config.service';
import { getRequestContext } from '../../../shared/request-context';

type SendSmsInput = {
  receiver: string;
  receiverName?: string;
  content: string;
  reserveDT?: string;
  adsYN?: boolean;
};

type SendKakaoTemplateInput = {
  receiver: string;
  receiverName?: string;
  pfId: string;
  templateId: string;
  variables: Record<string, string>;
};

type SendAllKakaoTemplateTestInput = {
  receiver: string;
  name: string;
  orderNo: string;
  product: string;
  amount: string;
  address: string;
  memo: string;
  bank: string;
  accountNumber: string;
  accountOwner: string;
  dueDate: string;
  authNumber: string;
};

type SendSingleKakaoTemplateTestInput = {
  receiver: string;
  receiverName?: string;
  templateKey: keyof typeof KAKAO_TEMPLATE_IDS;
  variables: Record<string, string>;
};

type FixedSmsConfig = {
  corpNum: string;
  sender: string;
  senderName?: string;
  userID?: string;
};

const SOLAPI_HISTORY_CORP_NUM = 'SOLAPI0000';
const SOLAPI_FIXED_SENDER = '01054055939';

type GetAdminSmsHistoryInput = {
  page: number;
  pageSize: number;
  query?: string;
  dateFrom?: string;
  dateTo?: string;
};

type SaveHistoryInput = {
  channel: AdminMessageChannel;
  receiver: string;
  receiverName?: string;
  content: string;
  reserveDT?: string | null;
  adsYN?: boolean;
  receiptNum?: string | null;
  status: AdminSmsStatus;
  errorMessage?: string | null;
  templateId?: string | null;
  config?: FixedSmsConfig | null;
};

@Injectable()
export class MessagesService {
  constructor(
    private readonly popbillSmsClient: PopbillSmsClient,
    private readonly solapiMessageClient: SolapiMessageClient,
    private readonly configService: ConfigService,
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
        channel: item.channel,
        templateId: item.templateId,
        status: item.status,
        errorMessage: item.errorMessage,
      })),
    };
  }

  async sendSms(input: SendSmsInput): Promise<{ receiptNum: string }> {
    const receiver = this.normalizePhone(input.receiver);
    if (!/^\d{8,20}$/.test(receiver)) {
      throw new BadRequestException('receiver는 유효한 수신번호(숫자 8~20자리)여야 합니다.');
    }

    let fixedConfig: FixedSmsConfig | null = null;
    let prefixedContent = input.content.trim();
    let useLegacyPopbill = false;

    try {
      prefixedContent = await this.applyShopNamePrefix(input.content);
      useLegacyPopbill = Boolean(input.reserveDT);

      if (useLegacyPopbill) {
        fixedConfig = this.getFixedSmsConfig();
      }

      let receiptNum = '';

      if (useLegacyPopbill && fixedConfig) {
        await this.popbillSmsClient.checkSenderNumber({
          corpNum: fixedConfig.corpNum,
          sender: fixedConfig.sender,
          userID: fixedConfig.userID,
        });
        console.info(
          `[POPBILL_SENDER_CHECK] ok corpNum=${fixedConfig.corpNum} sender=${fixedConfig.sender}`,
        );

        receiptNum = await this.popbillSmsClient.sendSms({
          ...fixedConfig,
          ...input,
          receiver,
          content: prefixedContent,
        });

        console.log(`[POPBILL_SMS_SEND] success corpNum=${fixedConfig.corpNum} sender=${fixedConfig.sender} receiptNum=${receiptNum}`);
      } else {
        receiptNum = await this.solapiMessageClient.sendSms({
          to: receiver,
          from: SOLAPI_FIXED_SENDER,
          text: prefixedContent,
        });
      }

      await this.saveHistory({
        channel: 'sms',
        receiver,
        receiverName: input.receiverName,
        content: prefixedContent,
        reserveDT: input.reserveDT ?? null,
        adsYN: Boolean(input.adsYN),
        receiptNum,
        status: 'success',
        errorMessage: null,
        templateId: null,
        config: fixedConfig,
      });

      return { receiptNum };
    } catch (error) {
      const message = error instanceof Error ? error.message : '알림 발송 중 알 수 없는 오류가 발생했습니다.';
      if (useLegacyPopbill && fixedConfig) {
        console.error(
          `[POPBILL_SENDER_CHECK] failed corpNum=${fixedConfig.corpNum} sender=${fixedConfig.sender} message=${message}`,
        );
      }

      await this.saveHistory({
        channel: 'sms',
        receiver,
        receiverName: input.receiverName,
        content: prefixedContent,
        reserveDT: input.reserveDT ?? null,
        adsYN: Boolean(input.adsYN),
        receiptNum: null,
        status: 'failed',
        errorMessage: message,
        templateId: null,
        config: fixedConfig,
      });

      throw new BadRequestException(`알림 발송에 실패했습니다. ${message}`);
    }
  }

  async sendKakaoTemplateWithFallback(input: SendKakaoTemplateInput): Promise<{
    receiptNum: string;
    fallbackUsed: boolean;
  }> {
    const receiver = this.normalizePhone(input.receiver);
    if (!/^\d{8,20}$/.test(receiver)) {
      throw new BadRequestException('receiver는 유효한 수신번호(숫자 8~20자리)여야 합니다.');
    }

    const resolvedVariables = this.applyTestPrefixToKakaoName(input.variables);

    const historyContent = JSON.stringify({
      templateId: input.templateId,
      variables: resolvedVariables,
    });

    try {
      const receiptNum = await this.solapiMessageClient.sendKakaoAlimtalk({
        to: receiver,
        from: SOLAPI_FIXED_SENDER,
        pfId: input.pfId,
        templateId: input.templateId,
        variables: resolvedVariables,
      });

      await this.saveHistory({
        channel: 'kakao',
        receiver,
        receiverName: input.receiverName,
        content: historyContent,
        reserveDT: null,
        adsYN: false,
        receiptNum,
        status: 'success',
        errorMessage: null,
        templateId: input.templateId,
        config: null,
      });

      return {
        receiptNum,
        fallbackUsed: false,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : '알림톡 전송 중 알 수 없는 오류가 발생했습니다.';
      console.warn(
        `[SOLAPI_KAKAO_SEND] failed templateId=${input.templateId} receiver=${receiver} message=${message}`,
      );

      await this.saveHistory({
        channel: 'kakao',
        receiver,
        receiverName: input.receiverName,
        content: historyContent,
        reserveDT: null,
        adsYN: false,
        receiptNum: null,
        status: 'failed',
        errorMessage: message,
        templateId: input.templateId,
        config: null,
      });

      throw new BadRequestException(`알림톡 전송에 실패했습니다. ${message}`);
    }
  }

  async sendAllKakaoTemplateTests(input: SendAllKakaoTemplateTestInput): Promise<{
    receiver: string;
    from: string;
    results: Array<{
      case: string;
      templateId: string;
      success: boolean;
      fallbackUsed: boolean;
      receiptNum: string | null;
      errorMessage: string | null;
    }>;
  }> {
    const receiver = this.normalizePhone(input.receiver);
    if (!/^\d{8,20}$/.test(receiver)) {
      throw new BadRequestException('receiver는 유효한 수신번호(숫자 8~20자리)여야 합니다.');
    }

    const orderVariables = {
      orderNo: input.orderNo,
      product: input.product,
      amount: input.amount,
      address: input.address,
      memo: input.memo,
    };

    const cases: Array<{
      caseName: string;
      templateId: string;
      variables: Record<string, string>;
      receiverName?: string;
    }> = [
      {
        caseName: 'order-cancel-completed',
        templateId: KAKAO_TEMPLATE_IDS.orderCancelCompleted,
        variables: orderVariables,
      },
      {
        caseName: 'order-cancel-requested',
        templateId: KAKAO_TEMPLATE_IDS.orderCancelRequested,
        variables: orderVariables,
      },
      {
        caseName: 'payment-confirmed',
        templateId: KAKAO_TEMPLATE_IDS.paymentConfirmed,
        variables: orderVariables,
      },
      {
        caseName: 'order-received',
        templateId: KAKAO_TEMPLATE_IDS.orderReceived,
        variables: {
          ...orderVariables,
          bank: input.bank,
          accountNumber: input.accountNumber,
          accountOwner: input.accountOwner,
          dueDate: input.dueDate,
        },
      },
      {
        caseName: 'auth-number',
        templateId: KAKAO_TEMPLATE_IDS.authNumber,
        variables: {
          number: input.authNumber,
        },
      },
      {
        caseName: 'signup-welcome',
        templateId: KAKAO_TEMPLATE_IDS.signupWelcome,
        variables: {
          name: input.name,
        },
        receiverName: input.name,
      },
      {
        caseName: 'delivery-started',
        templateId: KAKAO_TEMPLATE_IDS.deliveryStarted,
        variables: {
          name: input.name,
        },
        receiverName: input.name,
      },
    ];

    const results: Array<{
      case: string;
      templateId: string;
      success: boolean;
      fallbackUsed: boolean;
      receiptNum: string | null;
      errorMessage: string | null;
    }> = [];

    for (const item of cases) {
      try {
        const sent = await this.sendKakaoTemplateWithFallback({
          receiver,
          receiverName: item.receiverName,
          pfId: SOLAPI_PF_ID,
          templateId: item.templateId,
          variables: item.variables,
        });

        results.push({
          case: item.caseName,
          templateId: item.templateId,
          success: true,
          fallbackUsed: sent.fallbackUsed,
          receiptNum: sent.receiptNum,
          errorMessage: null,
        });
      } catch (error) {
        results.push({
          case: item.caseName,
          templateId: item.templateId,
          success: false,
          fallbackUsed: false,
          receiptNum: null,
          errorMessage: error instanceof Error ? error.message : '알 수 없는 오류',
        });
      }
    }

    return {
      receiver,
      from: SOLAPI_FIXED_SENDER,
      results,
    };
  }

  async sendSingleKakaoTemplateTest(input: SendSingleKakaoTemplateTestInput): Promise<{
    templateKey: keyof typeof KAKAO_TEMPLATE_IDS;
    templateId: string;
    receiptNum: string;
    fallbackUsed: boolean;
  }> {
    const templateId = KAKAO_TEMPLATE_IDS[input.templateKey];
    if (!templateId) {
      throw new BadRequestException('지원하지 않는 카카오 템플릿입니다.');
    }

    const sent = await this.sendKakaoTemplateWithFallback({
      receiver: input.receiver,
      receiverName: input.receiverName,
      pfId: SOLAPI_PF_ID,
      templateId,
      variables: input.variables,
    });

    return {
      templateKey: input.templateKey,
      templateId,
      receiptNum: sent.receiptNum,
      fallbackUsed: sent.fallbackUsed,
    };
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

  private async applyShopNamePrefix(content: string): Promise<string> {
    const storeConfig = await this.configService.getStoreConfig();
    const shopName = storeConfig.shopName.trim() || '상점';
    const prefix = `[${shopName}]`;
    const trimmed = content.trim();
    const prefixed = trimmed.startsWith(prefix) ? trimmed : `${prefix} ${trimmed}`;

    if (this.smsByteLength(prefixed) > 90) {
      throw new BadRequestException('상점명 접두어 포함 content는 SMS 기준 90byte를 초과할 수 없습니다.');
    }

    return prefixed;
  }

  private smsByteLength(content: string): number {
    return Array.from(content).reduce((sum, ch) => {
      return sum + (/[^\u0000-\u007f]/.test(ch) ? 2 : 1);
    }, 0);
  }

  private normalizePhone(value: string): string {
    return value.replace(/\D/g, '');
  }

  private applyTestPrefixToKakaoName(
    variables: Record<string, string>,
  ): Record<string, string> {
    const rawName = variables.name;
    if (typeof rawName !== 'string') {
      return variables;
    }

    const name = rawName.trim();
    if (!name) {
      return variables;
    }

    const isLocalTest = this.isLocalhost9002TestMode();
    if (!isLocalTest) {
      return variables;
    }

    if (name.startsWith('(테스트)')) {
      return {
        ...variables,
        name,
      };
    }

    return {
      ...variables,
      name: `(테스트) ${name}`,
    };
  }

  private isLocalhost9002TestMode(): boolean {
    const origin = getRequestContext()?.origin?.trim().toLowerCase();
    if (!origin) {
      return false;
    }

    try {
      const parsed = new URL(origin);
      return parsed.host === 'localhost:9002' || parsed.host === '127.0.0.1:9002';
    } catch {
      return origin.includes('localhost:9002') || origin.includes('127.0.0.1:9002');
    }
  }

  private async saveHistory(input: SaveHistoryInput): Promise<void> {
    await this.adminSmsHistoryRepository.save(
      this.adminSmsHistoryRepository.create({
        corpNum: input.config?.corpNum ?? SOLAPI_HISTORY_CORP_NUM,
        sender: input.config?.sender ?? SOLAPI_FIXED_SENDER,
        senderName: input.config?.senderName ?? null,
        userID: input.config?.userID ?? null,
        receiver: input.receiver,
        receiverName: input.receiverName ?? null,
        content: input.content,
        reserveDT: input.reserveDT ?? null,
        adsYN: Boolean(input.adsYN),
        receiptNum: input.receiptNum ?? null,
        channel: input.channel,
        templateId: input.templateId ?? null,
        status: input.status,
        errorMessage: input.errorMessage ?? null,
      }),
    );
  }
}
