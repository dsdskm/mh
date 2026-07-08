import { randomBytes, randomInt, scrypt as nodeScrypt } from 'node:crypto';
import { promisify } from 'node:util';
import { BadRequestException, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccountEntity } from '../../../database/entities/account.entity';
import { AccountShippingAddressEntity } from '../../../database/entities/account-shipping-address.entity';
import { CouponEntity } from '../../../database/entities/coupon.entity';
import { CouponTemplateEntity } from '../../../database/entities/coupon-template.entity';
import { MessagesService } from '../../messages/services/messages.service';
import { ConfigService } from '../../config/services/config.service';
import {
  CreateLocalAccountInput,
  LocalAccountProfile,
  RequestPhoneVerificationInput,
  VerifyPhoneCodeInput,
} from '../../../shared/store.types';

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
export class AuthService implements OnModuleInit, OnModuleDestroy {
  private static readonly SMS_CODE_EXPIRE_MS = 3 * 60 * 1000;
  private static readonly VERIFIED_TOKEN_EXPIRE_MS = 10 * 60 * 1000;
  private static readonly MAX_VERIFY_ATTEMPTS = 5;
  private static readonly CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

  private readonly phoneCodeStore = new Map<string, PhoneCodeState>();
  private readonly verifiedPhoneStore = new Map<string, VerifiedPhoneState>();
  private cleanupTimer: NodeJS.Timeout | null = null;

  onModuleInit() {
    this.cleanupTimer = setInterval(() => this.purgeExpired(), AuthService.CLEANUP_INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
  }

  private purgeExpired() {
    const now = Date.now();
    for (const [key, state] of this.phoneCodeStore) {
      if (now > state.expiresAt) this.phoneCodeStore.delete(key);
    }
    for (const [token, state] of this.verifiedPhoneStore) {
      if (now > state.expiresAt) this.verifiedPhoneStore.delete(token);
    }
  }

  constructor(
    @InjectRepository(AccountEntity)
    private readonly accountRepository: Repository<AccountEntity>,
    @InjectRepository(AccountShippingAddressEntity)
    private readonly shippingAddressRepository: Repository<AccountShippingAddressEntity>,
    @InjectRepository(CouponEntity)
    private readonly couponRepository: Repository<CouponEntity>,
    @InjectRepository(CouponTemplateEntity)
    private readonly couponTemplateRepository: Repository<CouponTemplateEntity>,
    private readonly configService: ConfigService,
    private readonly messagesService: MessagesService,
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

  async checkPhoneAvailability(rawPhone: string) {
    const phone = this.normalizePhone(rawPhone);
    this.assertPhoneFormat(phone);

    const existing = await this.accountRepository.findOne({ where: { phone } });

    if (existing) {
      return {
        available: false,
        message: '이미 사용 중인 번호입니다.',
      };
    }

    return {
      available: true,
      message: '사용 가능한 번호입니다.',
    };
  }

  async requestPhoneVerification(input: RequestPhoneVerificationInput) {
    const phone = this.normalizePhone(input.phone);
    this.assertPhoneFormat(phone);
    const purpose = input.purpose ?? 'signup';

    const existingPhone = await this.accountRepository.findOne({ where: { phone } });
    if (purpose === 'signup' && existingPhone) {
      console.log(`[AuthService] requestPhoneVerification: signup purpose but account already exists for phone ${phone}`);
      throw new BadRequestException('이미 가입되어 있는 번호입니다. 로그인해주세요.');
    }

    if (purpose === 'recover' && !existingPhone) {
      console.log(`[AuthService] requestPhoneVerification: recover purpose but no account found for phone ${phone}`);
      throw new BadRequestException('가입되지 않은 번호입니다. 번호를 확인해주세요.');
    }

    const code = this.createPhoneCode();
    const expiresAt = Date.now() + AuthService.SMS_CODE_EXPIRE_MS;

    this.phoneCodeStore.set(phone, {
      code,
      expiresAt,
      attempts: 0,
    });

    await this.sendPhoneCode(phone, code);

    return {
      ok: true,
      expiresAt: new Date(expiresAt).toISOString(),
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

  async signup(input: CreateLocalAccountInput): Promise<{
    account: LocalAccountProfile;
    signupCoupon: { issued: boolean; name: string | null };
  }> {
    const userId = input.userId.trim().toLowerCase();
    const password = input.password;
    const name = input.name.trim();
    const phone = this.normalizePhone(input.phone);
    const address1 = input.address1.trim();
    const address2 = input.address2.trim();
    const termsAgreed = input.termsAgreed;
    const verificationToken = input.verificationToken.trim();

    this.assertUserIdFormat(userId);
    this.assertPasswordFormat(password);
    this.assertPhoneFormat(phone);

    if (!name) {
      throw new BadRequestException('닉네임을 입력해주세요.');
    }

    if (!address1) {
      throw new BadRequestException('주소를 입력해주세요.');
    }

    if (termsAgreed !== true) {
      throw new BadRequestException('약관 동의가 필요합니다.');
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
        type: 'NORMAL',
        username: userId,
        password: passwordHash,
        providerUserId: null,
        email: null,
        displayName: name,
        phone,
        address1,
        address2,
        status: 'active',
        statusReason: null,
        termsAgreed: true,
        termsAgreedAt: new Date(),
        phoneVerifiedAt: new Date(),
        isActive: true,
      }),
    );

    await this.shippingAddressRepository.save(
      this.shippingAddressRepository.create({
        accountId: created.id,
        name: '기본 배송지',
        address1: created.address1 ?? address1,
        address2: created.address2 ?? address2,
        isDefault: true,
      }),
    );

    this.verifiedPhoneStore.delete(verificationToken);

    // 가입 쿠폰 자동 발급
    const signupCoupon = await this.issueSignupCouponIfConfigured(created.id);

    return {
      account: {
        id: created.id,
        userId: created.userId ?? '',
        name: created.displayName ?? '',
        phone: created.phone ?? '',
        address1: created.address1 ?? '',
        address2: created.address2 ?? '',
        createdAt: created.createdAt.toISOString(),
      },
      signupCoupon,
    };
  }

  private async issueSignupCouponIfConfigured(
    accountId: number,
  ): Promise<{ issued: boolean; name: string | null }> {
    try {
      const config = await this.configService.getStoreConfig();
      const templateId = config.signupCouponTemplateId;
      if (!templateId) {
        return { issued: false, name: null };
      }

      const template = await this.couponTemplateRepository.findOne({
        where: { id: templateId },
      });
      if (!template) {
        return { issued: false, name: null };
      }

      await this.couponRepository.save(
        this.couponRepository.create({
          accountId,
          name: template.name,
          discountType: template.discountType,
          discountValue: template.discountValue,
          minOrderAmount: template.minOrderAmount,
          maxDiscountAmount: template.maxDiscountAmount,
          validUntil: template.validUntil,
          status: 'available',
        }),
      );

      return { issued: true, name: template.name ?? null };
    } catch {
      // 쿠폰 발급 실패 시 가입 자체는 정상 처리되도록 에러를 삼킨다
      return { issued: false, name: null };
    }
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
  ): Promise<void> {
    try {
      await this.messagesService.sendSms({
        receiver: phone,
        receiverName: '웹 회원인증',
        content: `인증번호 [${code}]를 입력해주세요.`,
      });
    } catch (error) {
      const smsErrorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
      throw new BadRequestException(`문자 발송에 실패했습니다. ${smsErrorMessage}`);
    }
  }

  async login(userId: string, password: string): Promise<{ account: LocalAccountProfile }> {
    const normalizedUserId = userId.trim().toLowerCase();

    const account = await this.accountRepository.findOne({
      where: { userId: normalizedUserId },
    });

    if (!account || account.type !== 'NORMAL') {
      throw new BadRequestException('아이디 또는 비밀번호가 일치하지 않습니다.');
    }

    if (account.status !== 'active' || !account.isActive) {
      throw new BadRequestException('비활성화된 계정입니다. 고객센터로 문의해주세요.');
    }

    if (!account.password) {
      throw new BadRequestException('아이디 또는 비밀번호가 일치하지 않습니다.');
    }

    const isPasswordValid = await this.verifyPassword(password, account.password);
    if (!isPasswordValid) {
      throw new BadRequestException('아이디 또는 비밀번호가 일치하지 않습니다.');
    }

    return {
      account: {
        id: account.id,
        userId: account.userId ?? '',
        name: account.displayName ?? '',
        phone: account.phone ?? '',
        address1: account.address1 ?? '',
        address2: account.address2 ?? '',
        createdAt: account.createdAt.toISOString(),
      },
    };
  }

  async getProfile(userId: string) {
    const normalizedUserId = userId.trim().toLowerCase();
    const account = await this.accountRepository.findOne({
      where: { userId: normalizedUserId, type: 'NORMAL' },
    });

    if (!account) {
      throw new BadRequestException('회원 정보를 찾을 수 없습니다.');
    }

    let address1 = account.address1 ?? '';
    const address2 = account.address2 ?? '';

    // Backward compatibility: old rows may still have only legacy `address` populated.
    if (!address1) {
      const legacyRows = (await this.accountRepository.query(
        'SELECT address FROM accounts WHERE id = $1 LIMIT 1',
        [account.id],
      )) as Array<{ address?: string | null }>;
      const legacyAddress = legacyRows[0]?.address?.trim();
      if (legacyAddress) {
        address1 = legacyAddress;
      }
    }

    return {
      profile: {
        id: account.id,
        userId: account.userId ?? '',
        name: account.displayName ?? '',
        phone: account.phone ?? '',
        address1,
        address2,
        status: account.status,
        statusReason: account.statusReason,
      },
    };
  }

  async updateProfile(input: {
    userId: string;
    name: string;
    address1: string;
    address2: string;
    currentPassword: string;
    newPassword?: string;
  }) {
    const userId = input.userId.trim().toLowerCase();
    const name = input.name.trim();
    const address1 = input.address1.trim();
    const address2 = input.address2.trim();
    const currentPassword = input.currentPassword;
    const newPassword = input.newPassword?.trim();

    if (!name) {
      throw new BadRequestException('닉네임을 입력해주세요.');
    }

    if (!address1) {
      throw new BadRequestException('주소를 입력해주세요.');
    }

    const account = await this.accountRepository.findOne({
      where: { userId, type: 'NORMAL' },
    });

    if (!account || !account.password) {
      throw new BadRequestException('회원 정보를 찾을 수 없습니다.');
    }

    const passwordMatched = await this.verifyPassword(currentPassword, account.password);
    if (!passwordMatched) {
      throw new BadRequestException('현재 비밀번호가 일치하지 않습니다.');
    }

    let nextPasswordHash = account.password;
    if (newPassword) {
      this.assertPasswordFormat(newPassword);
      nextPasswordHash = await this.hashPassword(newPassword);
    }

    account.displayName = name;
    account.address1 = address1;
    account.address2 = address2;
    account.password = nextPasswordHash;

    const updated = await this.accountRepository.save(account);

    return {
      profile: {
        id: updated.id,
        userId: updated.userId ?? '',
        name: updated.displayName ?? '',
        phone: updated.phone ?? '',
        address1: updated.address1 ?? '',
        address2: updated.address2 ?? '',
      },
    };
  }

  async withdraw(input: { userId: string; password: string; reason?: string }) {
    const userId = input.userId.trim().toLowerCase();
    const reason = input.reason?.trim();
    const account = await this.accountRepository.findOne({
      where: { userId, type: 'NORMAL' },
    });

    if (!account || !account.password) {
      throw new BadRequestException('회원 정보를 찾을 수 없습니다.');
    }

    const passwordMatched = await this.verifyPassword(input.password, account.password);
    if (!passwordMatched) {
      throw new BadRequestException('비밀번호가 일치하지 않습니다.');
    }

    account.status = 'withdraw';
    account.statusReason = reason || '사용자 탈퇴 요청';
    account.isActive = false;

    await this.accountRepository.save(account);

    return {
      ok: true,
      message: '탈퇴 처리되었습니다.',
    };
  }

  async findUserId(input: { name: string; phone: string; verificationToken: string }) {
    const name = input.name.trim();
    const phone = this.normalizePhone(input.phone);
    const verificationToken = input.verificationToken.trim();
    this.assertPhoneFormat(phone);
    this.assertVerifiedPhoneToken(phone, verificationToken);

    const account = await this.accountRepository.findOne({
      where: {
        type: 'NORMAL',
        displayName: name,
        phone,
      },
    });

    if (!account || !account.userId) {
      throw new BadRequestException('일치하는 회원 정보를 찾을 수 없습니다.');
    }

    return {
      userId: account.userId,
    };
  }

  async resetPassword(input: {
    userId: string;
    phone: string;
    newPassword: string;
    verificationToken: string;
  }) {
    const userId = input.userId.trim().toLowerCase();
    const phone = this.normalizePhone(input.phone);
    const newPassword = input.newPassword;
    const verificationToken = input.verificationToken.trim();

    this.assertUserIdFormat(userId);
    this.assertPhoneFormat(phone);
    this.assertPasswordFormat(newPassword);
    this.assertVerifiedPhoneToken(phone, verificationToken);

    const account = await this.accountRepository.findOne({
      where: {
        type: 'NORMAL',
        userId,
        phone,
      },
    });

    if (!account) {
      throw new BadRequestException('일치하는 회원 정보를 찾을 수 없습니다.');
    }

    account.password = await this.hashPassword(newPassword);
    await this.accountRepository.save(account);

    return {
      ok: true,
      message: '비밀번호가 재설정되었습니다.',
    };
  }

  async getShippingAddresses(userIdRaw: string) {
    const userId = userIdRaw.trim().toLowerCase();
    const account = await this.accountRepository.findOne({
      where: { userId, type: 'NORMAL' },
    });

    if (!account) {
      throw new BadRequestException('회원 정보를 찾을 수 없습니다.');
    }

    const addresses = await this.shippingAddressRepository.find({
      where: { accountId: account.id },
      order: { updatedAt: 'DESC', id: 'DESC' },
    });

    return {
      shippingAddresses: addresses.map((item) => ({
        id: item.id,
        name: item.name,
        address1: item.address1 ?? '',
        address2: item.address2 ?? '',
        isDefault: item.isDefault,
      })),
    };
  }

  async upsertShippingAddress(input: {
    userId: string;
    id?: number;
    name: string;
    address1: string;
    address2?: string;
    isDefault?: boolean;
  }) {
    const userId = input.userId.trim().toLowerCase();
    const name = input.name.trim();
    const address1 = input.address1.trim();
    const address2 = input.address2?.trim() ?? '';

    if (!name) {
      throw new BadRequestException('배송지 이름을 입력해주세요.');
    }

    if (!address1) {
      throw new BadRequestException('배송지 주소를 입력해주세요.');
    }

    const account = await this.accountRepository.findOne({
      where: { userId, type: 'NORMAL' },
    });

    if (!account) {
      throw new BadRequestException('회원 정보를 찾을 수 없습니다.');
    }

    let preferAnotherDefaultAddressId: number | undefined;

    if (input.id) {
      const existing = await this.shippingAddressRepository.findOne({
        where: { id: input.id, accountId: account.id },
      });

      if (!existing) {
        throw new BadRequestException('수정할 배송지를 찾을 수 없습니다.');
      }

      const wasDefault = existing.isDefault;
      existing.name = name;
      existing.address1 = address1;
      existing.address2 = address2;
      if (typeof input.isDefault === 'boolean') {
        existing.isDefault = input.isDefault;
      }

      // If the current default is unchecked, promote another address as default after save.
      if (wasDefault && input.isDefault === false) {
        preferAnotherDefaultAddressId = existing.id;
      }

      if (existing.isDefault) {
        await this.shippingAddressRepository.update(
          { accountId: account.id, isDefault: true },
          { isDefault: false },
        );
      }

      await this.shippingAddressRepository.save(existing);
    } else {
      const hasAnyAddress = await this.shippingAddressRepository.count({
        where: { accountId: account.id },
      });
      const nextIsDefault = input.isDefault === true || hasAnyAddress === 0;

      if (nextIsDefault) {
        await this.shippingAddressRepository.update(
          { accountId: account.id, isDefault: true },
          { isDefault: false },
        );
      }

      await this.shippingAddressRepository.save(
        this.shippingAddressRepository.create({
          accountId: account.id,
          name,
          address1,
          address2,
          isDefault: nextIsDefault,
        }),
      );
    }

    await this.ensureSingleDefaultShippingAddress(
      account.id,
      preferAnotherDefaultAddressId,
    );

    return this.getShippingAddresses(userId);
  }

  private async ensureSingleDefaultShippingAddress(
    accountId: number,
    preferAnotherThanId?: number,
  ): Promise<void> {
    const addresses = await this.shippingAddressRepository.find({
      where: { accountId },
      order: { updatedAt: 'DESC', id: 'DESC' },
    });

    if (addresses.length === 0) {
      return;
    }

    const defaults = addresses.filter((item) => item.isDefault);

    if (defaults.length === 1) {
      return;
    }

    if (defaults.length > 1) {
      const keepDefaultId = defaults[0].id;

      for (const item of defaults) {
        if (item.id === keepDefaultId) {
          continue;
        }

        await this.shippingAddressRepository.update(
          { id: item.id, accountId },
          { isDefault: false },
        );
      }
      return;
    }

    const replacement =
      addresses.find((item) => item.id !== preferAnotherThanId) ?? addresses[0];

    await this.shippingAddressRepository.update(
      { id: replacement.id, accountId },
      { isDefault: true },
    );
  }

  private async hashPassword(password: string): Promise<string> {
    const salt = randomBytes(16).toString('hex');
    const key = (await scrypt(password, salt, 64)) as Buffer;
    return `${salt}:${key.toString('hex')}`;
  }

  private assertVerifiedPhoneToken(phone: string, verificationToken: string): void {
    if (!verificationToken) {
      throw new BadRequestException('문자 인증이 필요합니다.');
    }

    const verified = this.verifiedPhoneStore.get(verificationToken);
    if (!verified || verified.phone !== phone) {
      throw new BadRequestException('문자 인증 정보가 올바르지 않습니다. 다시 인증해주세요.');
    }

    if (Date.now() > verified.expiresAt) {
      this.verifiedPhoneStore.delete(verificationToken);
      throw new BadRequestException('문자 인증이 만료되었습니다. 다시 인증해주세요.');
    }
  }

  private async verifyPassword(password: string, hash: string): Promise<boolean> {
    try {
      const [salt, key] = hash.split(':');
      const keyBuffer = (await scrypt(password, salt, 64)) as Buffer;
      return keyBuffer.toString('hex') === key;
    } catch {
      return false;
    }
  }
}
