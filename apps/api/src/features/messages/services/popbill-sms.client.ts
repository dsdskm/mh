import { Injectable } from '@nestjs/common';

const popbill = require('popbill');

type PopbillSendSmsInput = {
  corpNum: string;
  sender: string;
  senderName?: string;
  receiver: string;
  receiverName?: string;
  content: string;
  reserveDT?: string;
  adsYN?: boolean;
  userID?: string;
};

type PopbillError = {
  code?: string | number;
  message?: string;
};

@Injectable()
export class PopbillSmsClient {
  private configured = false;
  private senderChecked = new Set<string>();
  private messageService: {
    sendSMS: (...args: unknown[]) => void;
    checkSenderNumber: (...args: unknown[]) => void;
    cancelReserve: (...args: unknown[]) => void;
  } | null = null;

  async checkSenderNumber(input: {
    corpNum: string;
    sender: string;
    userID?: string;
  }): Promise<void> {
    const cacheKey = `${input.corpNum}:${input.sender}:${input.userID ?? ''}`;
    if (this.senderChecked.has(cacheKey)) {
      return;
    }

    const service = this.getMessageService();

    await new Promise<void>((resolve, reject) => {
      service.checkSenderNumber(
        input.corpNum,
        input.sender,
        input.userID ?? '',
        () => resolve(),
        (error: PopbillError) => {
          const code = error?.code ?? 'UNKNOWN';
          const message = error?.message ?? '팝빌 등록 발신번호 확인에 실패했습니다.';
          reject(new Error(`[${code}] ${message}`));
        },
      );
    });

    this.senderChecked.add(cacheKey);
  }

  async sendSms(input: PopbillSendSmsInput): Promise<string> {
    const service = this.getMessageService();

    return new Promise((resolve, reject) => {
      service.sendSMS(
        input.corpNum,
        input.sender,
        input.receiver,
        input.receiverName ?? '',
        input.content,
        input.reserveDT ?? '',
        Boolean(input.adsYN),
        input.senderName ?? '',
        '',
        input.userID ?? '',
        (receiptNum: string) => resolve(receiptNum),
        (error: PopbillError) => {
          const code = error?.code ?? 'UNKNOWN';
          const message = error?.message ?? '팝빌 문자 전송 중 오류가 발생했습니다.';
          reject(new Error(`[${code}] ${message}`));
        },
      );
    });
  }

  async cancelReserve(input: {
    corpNum: string;
    receiptNum: string;
    userID?: string;
  }): Promise<void> {
    const service = this.getMessageService();

    return new Promise((resolve, reject) => {
      service.cancelReserve(
        input.corpNum,
        input.receiptNum,
        input.userID ?? '',
        () => resolve(),
        (error: PopbillError) => {
          const code = error?.code ?? 'UNKNOWN';
          const message = error?.message ?? '팝빌 예약 문자 취소 중 오류가 발생했습니다.';
          reject(new Error(`[${code}] ${message}`));
        },
      );
    });
  }

  private getMessageService(): {
    sendSMS: (...args: unknown[]) => void;
    checkSenderNumber: (...args: unknown[]) => void;
    cancelReserve: (...args: unknown[]) => void;
  } {
    if (!this.configured) {
      const linkID = process.env.LINK_ID?.trim();
      const secretKey = process.env.SECRET_KEY?.trim();

      if (!linkID || !secretKey) {
        throw new Error('LINK_ID 또는 SECRET_KEY 환경변수가 누락되었습니다.');
      }

      popbill.config({
        LinkID: linkID,
        SecretKey: secretKey,
        IsTest: this.resolveIsTestMode(),
        defaultErrorHandler: () => {
          // We handle errors per-request via callback.
        },
      });

      this.messageService = popbill.MessageService();
      this.configured = true;
    }

    if (!this.messageService) {
      throw new Error('팝빌 MessageService를 초기화하지 못했습니다.');
    }

    return this.messageService;
  }

  private resolveIsTestMode(): boolean {
    const explicit = process.env.POPBILL_IS_TEST?.trim().toLowerCase();
    if (explicit === 'true') {
      return true;
    }
    if (explicit === 'false') {
      return false;
    }

    return Boolean(process.env.URL_TEST?.trim());
  }
}
