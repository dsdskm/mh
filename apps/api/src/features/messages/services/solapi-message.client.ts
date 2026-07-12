import { Injectable } from '@nestjs/common';

const { SolapiMessageService } = require('solapi');

type SolapiSendSmsInput = {
  to: string;
  from: string;
  text: string;
};

type SolapiSendKakaoInput = {
  to: string;
  from: string;
  pfId: string;
  templateId: string;
  variables: Record<string, string>;
};

@Injectable()
export class SolapiMessageClient {
  private messageService: {
    send: (payload: Record<string, unknown>) => Promise<unknown>;
  } | null = null;

  async sendSms(input: SolapiSendSmsInput): Promise<string> {
    const service = this.getMessageService();
    const response = await service.send({
      to: input.to,
      from: input.from,
      text: input.text,
    });

    return this.extractReceiptNum(response);
  }

  async sendKakaoAlimtalk(input: SolapiSendKakaoInput): Promise<string> {
    const service = this.getMessageService();
    const response = await service.send({
      to: input.to,
      from: input.from,
      kakaoOptions: {
        pfId: input.pfId,
        templateId: input.templateId,
        variables: this.normalizeKakaoVariables(input.variables),
        disableSms: true,
      },
    });

    return this.extractReceiptNum(response);
  }

  private getMessageService(): {
    send: (payload: Record<string, unknown>) => Promise<unknown>;
  } {
    if (this.messageService) {
      return this.messageService;
    }

    const apiKey = (process.env.SOLAPI_API_KEY ?? '').trim();
    const apiSecret = (process.env.SOLAPI_API_SECRET ?? '').trim();

    if (!apiKey || !apiSecret) {
      throw new Error('SOLAPI_API_KEY 또는 SOLAPI_API_SECRET 환경변수가 누락되었습니다.');
    }

    this.messageService = new SolapiMessageService(apiKey, apiSecret);
    const service = this.messageService;
    if (!service) {
      throw new Error('SolapiMessageService를 초기화하지 못했습니다.');
    }

    return service;
  }

  private normalizeKakaoVariables(variables: Record<string, string>): Record<string, string> {
    const out: Record<string, string> = {};

    for (const [rawKey, rawValue] of Object.entries(variables)) {
      const key = rawKey.trim();
      if (!key) {
        continue;
      }

      const normalizedKey = key.startsWith('#{') ? key : `#{${key}}`;
      out[normalizedKey] = String(rawValue ?? '');
    }

    return out;
  }

  private extractReceiptNum(response: unknown): string {
    const data = response as {
      groupId?: unknown;
      messageId?: unknown;
      messageList?: Array<{ messageId?: unknown }>;
    };

    const fromMessage = data.messageList?.[0]?.messageId;
    const candidate = data.groupId ?? data.messageId ?? fromMessage;
    const receiptNum = candidate ? String(candidate) : `solapi-${Date.now()}`;
    return receiptNum.slice(0, 64);
  }
}