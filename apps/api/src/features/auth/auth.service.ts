import { randomBytes, randomInt, scrypt as nodeScrypt } from 'node:crypto';
import { promisify } from 'node:util';
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccountEntity } from '../../database/entities/account.entity';
import {
  CreateLocalAccountInput,
  LocalAccountProfile,
  RequestPhoneVerificationInput,
  VerifyPhoneCodeInput,
} from '../../shared/store.types';

const scrypt = promisify(nodeScrypt);

type PhoneCodeState = {
  code: string;
  expiresAt: number;
  attempts: number;
};

type VerifiedPhoneState = {
  phone: string;
  expiresAt: number;
};

@Injectable()
export class AuthService {
  private static readonly SMS_CODE_EXPIRE_MS = 3 * 60 * 1000;
  private static readonly VERIFIED_TOKEN_EXPIRE_MS = 10 * 60 * 1000;
  private static readonly MAX_VERIFY_ATTEMPTS = 5;

  private readonly phoneCodeStore = new Map<string, PhoneCodeState>();
  private readonly verifiedPhoneStore = new Map<string, VerifiedPhoneState>();

  constructor(
    @InjectRepository(AccountEntity)
    private readonly accountRepository: Repository<AccountEntity>,
  ) {}

  async checkUserIdAvailability(rawUserId: string) {
    const userId = rawUserId.trim().toLowerCase();
    this.assertUserIdFormat(userId);

    const existing = await this.accountRepository.findOne({ where: { userId } });

    if (existing) {
      return {
        available: false,
        message: '이미 사용 중인 아이디입니다.',
      };
    }

    return {
      available: true,
      message: '사용 가능한 아이디입니다.',
    };
  }

  async requestPhoneVerification(input: RequestPhoneVerificationInput) {
    const phone = this.normalizePhone(input.phone);
    this.assertPhoneFormat(phone);

    const existingPhone = await this.accountRepository.findOne({ where: { phone } });
    if (existingPhone) {
      throw new BadRequestException('이미 가입되어 있는 번호입니다. 로그인해주세요.');
    }

    const code = this.createPhoneCode();
    const expiresAt = Date.now() + AuthService.SMS_CODE_EXPIRE_MS;

    this.phoneCodeStore.set(phone, {
      code,
      expiresAt,
      attempts: 0,
    });

    const isProduction = process.env.NODE_ENV === 'production';
    await this.sendPhoneCode(phone, code, isProduction);

    return {
      ok: true,
      expiresAt: new Date(expiresAt).toISOString(),
      devCode: isProduction ? undefined : code,
    };
  }

  verifyPhoneCode(input: VerifyPhoneCodeInput) {
    const phone = this.normalizePhone(input.phone);
    const code = input.code.trim();

    this.assertPhoneFormat(phone);

    const state = this.phoneCodeStore.get(phone);
    if (!state) {
      throw new BadRequestException('인증요청을 먼저 진행해주세요.');
    }

    if (Date.now() > state.expiresAt) {
      this.phoneCodeStore.delete(phone);
      throw new BadRequestException('인증번호가 만료되었습니다. 다시 요청해주세요.');
    }

    if (state.attempts >= AuthService.MAX_VERIFY_ATTEMPTS) {
      this.phoneCodeStore.delete(phone);
      throw new BadRequestException('인증 시도 횟수를 초과했습니다. 다시 요청해주세요.');
    }

    if (state.code !== code) {
      state.attempts += 1;
      this.phoneCodeStore.set(phone, state);

      throw new BadRequestException('인증번호가 일치하지 않습니다.');
    }

    this.phoneCodeStore.delete(phone);

    const verificationToken = randomBytes(24).toString('hex');
    const expiresAt = Date.now() + AuthService.VERIFIED_TOKEN_EXPIRE_MS;

    this.verifiedPhoneStore.set(verificationToken, {
      phone,
      expiresAt,
    });

    return {
      ok: true,
      verificationToken,
      expiresAt: new Date(expiresAt).toISOString(),
    };
  }

  async signup(input: CreateLocalAccountInput): Promise<{ account: LocalAccountProfile }> {
    const userId = input.userId.trim().toLowerCase();
    const password = input.password;
    const name = input.name.trim();
    const phone = this.normalizePhone(input.phone);
    const address = input.address.trim();
    const verificationToken = input.verificationToken.trim();

    this.assertUserIdFormat(userId);
    this.assertPasswordFormat(password);
    this.assertPhoneFormat(phone);

    if (!name) {
      throw new BadRequestException('닉네임을 입력해주세요.');
    }

    if (!address) {
      throw new BadRequestException('주소를 입력해주세요.');
    }

    const verified = this.verifiedPhoneStore.get(verificationToken);
    if (!verified || verified.phone !== phone) {
      throw new BadRequestException('전화번호 인증이 필요합니다.');
    }

    if (Date.now() > verified.expiresAt) {
      this.verifiedPhoneStore.delete(verificationToken);
      throw new BadRequestException('전화번호 인증이 만료되었습니다. 다시 인증해주세요.');
    }

    const [existingUserId, existingPhone] = await Promise.all([
      this.accountRepository.findOne({ where: { userId } }),
      this.accountRepository.findOne({ where: { phone } }),
    ]);

    if (existingUserId) {
      throw new BadRequestException('이미 사용 중인 아이디입니다.');
    }

    if (existingPhone) {
      throw new BadRequestException('이미 가입되어 있는 번호입니다. 로그인해주세요.');
    }

    const passwordHash = await this.hashPassword(password);

    const created = await this.accountRepository.save(
      this.accountRepository.create({
        userId,
        type: 'LOCAL',
        username: userId,
        password: passwordHash,
        providerUserId: null,
        email: null,
        displayName: name,
        phone,
        address,
        phoneVerifiedAt: new Date(),
        isActive: true,
      }),
    );

    this.verifiedPhoneStore.delete(verificationToken);

    return {
      account: {
        id: created.id,
        userId: created.userId ?? '',
        name: created.displayName ?? '',
        phone: created.phone ?? '',
        address: created.address ?? '',
        createdAt: created.createdAt.toISOString(),
      },
    };
  }

  private normalizePhone(phone: string): string {
    return phone.replace(/\D/g, '');
  }

  private assertPhoneFormat(phone: string): void {
    if (!/^01\d{8,9}$/.test(phone)) {
      throw new BadRequestException('유효한 휴대폰 번호를 입력해주세요.');
    }
  }

  private assertUserIdFormat(userId: string): void {
    if (!/^[a-z0-9][a-z0-9._-]{3,19}$/.test(userId)) {
      throw new BadRequestException('아이디는 영문 소문자/숫자 포함 4~20자로 입력해주세요.');
    }
  }

  private assertPasswordFormat(password: string): void {
    const hasLetter = /[a-zA-Z]/.test(password);
    const hasDigit = /\d/.test(password);
    const hasSpecial = /[^a-zA-Z0-9]/.test(password);

    if (password.length < 8 || !hasLetter || !hasDigit || !hasSpecial) {
      throw new BadRequestException(
        '비밀번호는 영문+숫자+특수문자 포함 8자 이상이어야 합니다.',
      );
    }
  }

  private createPhoneCode(): string {
    return String(randomInt(0, 1_000_000)).padStart(6, '0');
  }

  private async sendPhoneCode(
    phone: string,
    code: string,
    isProduction: boolean,
  ): Promise<void> {
    const webhookUrl = process.env.SMS_WEBHOOK_URL?.trim();
    const message = `[옥수수마켓] 인증번호 ${code} 를 입력해주세요.`;

    if (!webhookUrl) {
      if (isProduction) {
        throw new BadRequestException('문자 발송 설정이 누락되었습니다. 관리자에게 문의해주세요.');
      }

      // Dev fallback: print code for local testing when SMS gateway is not configured.
      console.info(`[DEV_SMS] to=${phone}, code=${code}`);
      return;
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: phone,
        message,
      }),
    });

    if (!response.ok) {
      throw new BadRequestException('문자 발송에 실패했습니다. 잠시 후 다시 시도해주세요.');
    }
  }

  private async hashPassword(password: string): Promise<string> {
    const salt = randomBytes(16).toString('hex');
    const key = (await scrypt(password, salt, 64)) as Buffer;
    return `${salt}:${key.toString('hex')}`;
  }
}
