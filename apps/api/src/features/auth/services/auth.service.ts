import { randomBytes, randomInt, scrypt as nodeScrypt } from 'node:crypto';
import { promisify } from 'node:util';
import { BadRequestException, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccountEntity } from '../../../database/entities/account.entity';
import { AccountKakaoEntity } from '../../../database/entities/account-kakao.entity';
import { CouponEntity } from '../../../database/entities/coupon.entity';
import { CouponTemplateEntity } from '../../../database/entities/coupon-template.entity';
import { SignupCouponClaimEntity } from '../../../database/entities/signup-coupon-claim.entity';
import { MessagesService } from '../../messages/services/messages.service';
import { KAKAO_TEMPLATE_IDS, SOLAPI_PF_ID } from '../../messages/services/kakao-template.constants';
import { ConfigService } from '../../config/services/config.service';
import { postKakaoAdminUserAction } from '../../../shared/kakao/kakao-admin.client';
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

type KakaoTokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
};

type KakaoUserResponse = {
  id?: number;
  connected_at?: string;
  properties?: {
    nickname?: string;
    profile_image?: string;
    thumbnail_image?: string;
  };
  kakao_account?: {
    profile_nickname_needs_agreement?: boolean;
    profile_image_needs_agreement?: boolean;
    name_needs_agreement?: boolean;
    phone_number_needs_agreement?: boolean;
    email_needs_agreement?: boolean;
    email?: string;
    name?: string;
    phone_number?: string;
    profile?: {
      nickname?: string;
      profile_image_url?: string;
      thumbnail_image_url?: string;
      is_default_image?: boolean;
      is_default_nickname?: boolean;
    };
  };
};

type KakaoShippingAddress = {
  id?: number;
  name?: string;
  is_default?: boolean;
  updated_at?: number;
  type?: string;
  base_address?: string;
  detail_address?: string;
  receiver_name?: string;
  receiver_phone_number1?: string;
  receiver_phone_number2?: string;
  zone_number?: string;
};

type KakaoShippingAddressResponse = {
  user_id?: number;
  shipping_addresses_needs_agreement?: boolean;
  shipping_addresses?: KakaoShippingAddress[];
  has_more?: boolean;
};

type ParsedKakaoProfile = {
  providerUserId: string;
  displayName: string;
  kakaoNickname: string | null;
  email: string | null;
  normalizedPhone: string | null;
  address1: string | null;
  address2: string | null;
  profileImageUrl: string | null;
  thumbnailImageUrl: string | null;
  shippingZoneNumber: string | null;
  shippingName: string | null;
  shippingReceiverName: string | null;
  shippingReceiverPhone1: string | null;
  shippingReceiverPhone2: string | null;
  consentNeedsAgreement: {
    name?: boolean;
    nickname?: boolean;
    profileImage?: boolean;
    phoneNumber?: boolean;
    shippingAddress?: boolean;
  };
  shippingAddressCount: number;
  defaultShippingAddress: KakaoShippingAddress | null;
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
    @InjectRepository(AccountKakaoEntity)
    private readonly accountKakaoRepository: Repository<AccountKakaoEntity>,
    @InjectRepository(CouponEntity)
    private readonly couponRepository: Repository<CouponEntity>,
    @InjectRepository(CouponTemplateEntity)
    private readonly couponTemplateRepository: Repository<CouponTemplateEntity>,
    @InjectRepository(SignupCouponClaimEntity)
    private readonly signupCouponClaimRepository: Repository<SignupCouponClaimEntity>,
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

    const existing = await this.findSignupBlockingPhoneAccount(phone);

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

    const existingPhone = await this.findSignupBlockingPhoneAccount(phone);
    if (purpose === 'signup' && existingPhone) {
      console.log(`[AuthService] requestPhoneVerification: signup purpose but account already exists for phone ${phone}`);
      throw new BadRequestException('이미 가입되어 있는 번호입니다. 로그인해주세요.');
    }

    const existingPhoneAny = existingPhone ?? (await this.accountRepository.findOne({ where: { phone } }));
    if (purpose === 'recover' && !existingPhoneAny) {
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
      this.findSignupBlockingPhoneAccount(phone),
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
            // Removed type-based branches
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

    this.verifiedPhoneStore.delete(verificationToken);

    // 가입 쿠폰 자동 발급
    const signupCoupon = await this.issueSignupCouponIfConfigured({
      accountId: created.id,
      phone,
      providerUserId: null,
    });
    void this.sendSignupWelcomeMessage(created.phone ?? phone, created.displayName ?? name);

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

  private async issueSignupCouponIfConfigured(input: {
    accountId: number;
    phone: string | null;
    providerUserId: string | null;
  },
  ): Promise<{ issued: boolean; name: string | null }> {
    console.info('[auth:signup-coupon] issuance check start', {
      accountId: input.accountId,
      providerUserId: input.providerUserId,
      hasPhone: Boolean(input.phone),
      phoneTail: input.phone ? input.phone.slice(-4) : null,
    });

    const config = await this.configService.getStoreConfig();
    const configuredTemplateId = config.signupCouponTemplateId;

    let template = configuredTemplateId
      ? await this.couponTemplateRepository.findOne({
          where: { id: configuredTemplateId },
        })
      : null;

    // 운영 중 설정값이 general로 남아 있어도, 명시적으로 선택된 템플릿이면 가입 쿠폰으로 사용합니다.
    if (template && !this.isSignupTemplateUsage(template.usage)) {
      console.warn('[auth:signup-coupon] configured template usage is not signup, but will be used', {
        templateId: template.id,
        usage: template.usage,
      });
    }

    if (!template) {
      template = await this.findLatestSignupTemplate();
    }

    if (!template) {
      console.warn('[auth:signup-coupon] no signup template found, skip issuance', {
        accountId: input.accountId,
        configuredTemplateId,
      });
      return { issued: false, name: null };
    }

    console.info('[auth:signup-coupon] template selected', {
      accountId: input.accountId,
      templateId: template.id,
      templateName: template.name,
      usage: template.usage,
      configuredTemplateId,
    });

    const savedCoupon = await this.couponRepository.save(
      this.couponRepository.create({
        accountId: input.accountId,
        name: template.name,
        discountType: template.discountType,
        discountValue: template.discountValue,
        minOrderAmount: template.minOrderAmount,
        maxDiscountAmount: template.maxDiscountAmount,
        validUntil: template.validUntil,
        status: 'available',
      }),
    );

    console.info('[auth:signup-coupon] coupon row inserted', {
      couponId: savedCoupon.id,
      accountId: savedCoupon.accountId,
      name: savedCoupon.name,
      status: savedCoupon.status,
    });

    const savedClaim = await this.signupCouponClaimRepository.save(
      this.signupCouponClaimRepository.create({
        accountId: input.accountId,
        phone: input.phone,
        providerUserId: input.providerUserId,
        templateName: template.name,
      }),
    );

    console.info('[auth:signup-coupon] claim row inserted', {
      claimId: savedClaim.id,
      accountId: savedClaim.accountId,
      providerUserId: savedClaim.providerUserId,
      hasPhone: Boolean(savedClaim.phone),
      templateName: savedClaim.templateName,
    });

    return { issued: true, name: template.name ?? null };
  }

  private async findLatestSignupTemplate(): Promise<CouponTemplateEntity | null> {
    const templates = await this.couponTemplateRepository.find({
      order: { createdAt: 'DESC' },
    });

    return templates.find((item) => this.isSignupTemplateUsage(item.usage)) ?? null;
  }

  private isSignupTemplateUsage(usage: string | null | undefined): boolean {
    return (usage ?? '').trim().toLowerCase() === 'signup';
  }

  private normalizePhone(phone: string): string {
    return phone.replace(/\D/g, '');
  }

  private async findSignupBlockingPhoneAccount(phone: string) {
    const existing = await this.accountRepository.findOne({ where: { phone } });
    if (!existing) {
      return null;
    }

    return this.isMasterUserId(existing.userId) ? null : existing;
  }

  private isMasterUserId(userId: string | null | undefined): boolean {
    return (userId ?? '').trim().toLowerCase() === 'master';
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
    const fallbackContent = `인증번호 [${code}]를 입력해주세요.`;

    try {
      await this.messagesService.sendKakaoTemplateWithFallback({
        receiver: phone,
        receiverName: '웹 회원인증',
        pfId: SOLAPI_PF_ID,
        templateId: KAKAO_TEMPLATE_IDS.authNumber,
        variables: {
          number: code,
        },
        fallbackContent,
      });
    } catch (error) {
      const smsErrorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
      throw new BadRequestException(`알림 발송에 실패했습니다. ${smsErrorMessage}`);
    }
  }

  private async sendSignupWelcomeMessage(phone: string, name: string): Promise<void> {
    const normalizedPhone = this.normalizePhone(phone);
    if (!/^01\d{8,9}$/.test(normalizedPhone)) {
      return;
    }

    const memberName = name.trim() || '고객';

    try {
      await this.messagesService.sendKakaoTemplateWithFallback({
        receiver: normalizedPhone,
        receiverName: memberName,
        pfId: SOLAPI_PF_ID,
        templateId: KAKAO_TEMPLATE_IDS.signupWelcome,
        variables: {
          name: memberName,
        },
        fallbackContent: `${memberName}님 회원가입을 환영합니다.`,
      });
    } catch (error) {
      console.warn('[auth] 회원가입 환영 메시지 전송 실패', {
        phone: normalizedPhone,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async login(userId: string, password: string): Promise<{ account: LocalAccountProfile }> {
    const normalizedUserId = userId.trim().toLowerCase();

    console.info('[auth:login] service input', {
      userId,
      password,
      normalizedUserId,
    });

    const account = await this.accountRepository.findOne({
      where: { userId: normalizedUserId },
    });

    console.info('[auth:login] account lookup result', {
      found: Boolean(account),
      accountStatus: account?.status,
      accountStatusReason: account?.statusReason,
      isActive: account?.isActive,
      hasPassword: Boolean(account?.password),
      accountId: account?.id,
      accountUserId: account?.userId,
    });

    if (!account || !account.password) {
      console.warn('[auth:login] rejected by account type or missing account', {
        normalizedUserId,
        found: Boolean(account),
        hasPassword: Boolean(account?.password),
      });
      throw new BadRequestException('아이디 또는 비밀번호가 일치하지 않습니다.');
    }

    if (account.status !== 'active' || !account.isActive) {
      console.warn('[auth:login] rejected by inactive status', {
        normalizedUserId,
        accountId: account.id,
        accountStatus: account.status,
        accountStatusReason: account.statusReason,
        isActive: account.isActive,
      });
      throw new BadRequestException('비활성화된 계정입니다. 고객센터로 문의해주세요.');
    }

    if (!account.password) {
      console.warn('[auth:login] rejected by missing password hash', {
        normalizedUserId,
        accountId: account.id,
      });
      throw new BadRequestException('아이디 또는 비밀번호가 일치하지 않습니다.');
    }

    const isPasswordValid = await this.verifyPassword(password, account.password);
    console.info('[auth:login] password verify result', {
      normalizedUserId,
      isPasswordValid,
    });

    if (!isPasswordValid) {
      console.warn('[auth:login] rejected by invalid password', {
        normalizedUserId,
        accountId: account.id,
      });
      throw new BadRequestException('아이디 또는 비밀번호가 일치하지 않습니다.');
    }

    console.info('[auth:login] success', {
      normalizedUserId,
      accountId: account.id,
    });

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

  async loginWithKakaoCode(input: {
    code: string;
    redirectUri: string;
  }): Promise<{ account: LocalAccountProfile; showSignupCouponPopup: boolean }> {
    console.info('[auth:kakao] service input', {
      hasCode: Boolean(input.code),
      redirectUri: input.redirectUri,
    });

    const { kakaoRestApiKey, kakaoClientSecret } = this.resolveKakaoCredentials();
    const accessToken = await this.requestKakaoAccessToken({
      code: input.code,
      redirectUri: input.redirectUri,
      kakaoRestApiKey,
      kakaoClientSecret,
    });
    const kakaoUser = await this.fetchKakaoUserProfile(accessToken);
    const kakaoShipping = await this.fetchKakaoShippingAddress(accessToken);
    const parsed = this.parseKakaoProfile(kakaoUser, kakaoShipping);
    const { account, showSignupCouponPopup } = await this.upsertKakaoAccount(parsed, kakaoUser, kakaoShipping);
    this.assertKakaoAccountActive(account, parsed.providerUserId);

    console.info('[auth:kakao] login success', {
      accountId: account.id,
      userId: account.userId,
      accountType: account.providerUserId ? 'KAKAO' : 'NORMAL',
      hasPhone: Boolean(account.phone),
      hasAddress1: Boolean(account.address1),
      showSignupCouponPopup,
    });

    return {
      account: {
        id: account.id,
        userId: account.userId ?? '',
        name: account.displayName ?? '카카오회원',
        phone: account.phone ?? '',
        address1: account.address1 ?? '',
        address2: account.address2 ?? '',
        createdAt: account.createdAt.toISOString(),
      },
      showSignupCouponPopup,
    };
  }

  private resolveKakaoCredentials(): {
    kakaoRestApiKey: string;
    kakaoClientSecret: string;
  } {
    const kakaoRestApiKey =
      process.env.KAKAO_REST_API_KEY?.trim() ||
      process.env.NEXT_PUBLIC_KAKAO_REST_API_KEY?.trim() ||
      '';
    const kakaoClientSecret = process.env.KAKAO_CLIENT_SECRET?.trim() || '';

    console.info('[auth:kakao] resolved credentials', {
      hasRestApiKey: Boolean(kakaoRestApiKey),
      hasClientSecret: Boolean(kakaoClientSecret),
      clientIdSuffix: kakaoRestApiKey ? kakaoRestApiKey.slice(-4) : null,
    });

    if (!kakaoRestApiKey) {
      throw new BadRequestException('카카오 로그인 설정이 누락되었습니다. 관리자에게 문의해주세요.');
    }

    return {
      kakaoRestApiKey,
      kakaoClientSecret,
    };
  }

  private async requestKakaoAccessToken(input: {
    code: string;
    redirectUri: string;
    kakaoRestApiKey: string;
    kakaoClientSecret: string;
  }): Promise<string> {
    const tokenBody = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: input.kakaoRestApiKey,
      redirect_uri: input.redirectUri,
      code: input.code,
    });

    if (input.kakaoClientSecret) {
      tokenBody.set('client_secret', input.kakaoClientSecret);
    }

    console.info('[auth:kakao] token request payload', {
      tokenEndpoint: 'https://kauth.kakao.com/oauth/token',
      redirectUri: input.redirectUri,
      hasCode: Boolean(input.code),
      hasClientSecret: Boolean(input.kakaoClientSecret),
    });

    const tokenResponse = await fetch('https://kauth.kakao.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
      },
      body: tokenBody.toString(),
    });

    const tokenData = (await tokenResponse.json().catch(() => ({}))) as KakaoTokenResponse;
    console.info('[auth:kakao] token response', {
      status: tokenResponse.status,
      ok: tokenResponse.ok,
      hasAccessToken: Boolean(tokenData.access_token),
      error: tokenData.error,
      errorDescription: tokenData.error_description,
    });

    if (!tokenResponse.ok || !tokenData.access_token) {
      throw new BadRequestException(
        tokenData.error_description || tokenData.error || '카카오 토큰 발급에 실패했습니다.',
      );
    }

    return tokenData.access_token;
  }

  private async fetchKakaoUserProfile(accessToken: string): Promise<KakaoUserResponse> {
    const userUrl = new URL('https://kapi.kakao.com/v2/user/me');
    userUrl.searchParams.set('secure_resource', 'true');
    userUrl.searchParams.set(
      'property_keys',
      JSON.stringify([
        'kakao_account.profile',
        'kakao_account.name',
        'kakao_account.email',
        'kakao_account.phone_number',
      ]),
    );

    const userResponse = await fetch(userUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const kakaoUser = (await userResponse.json().catch(() => ({}))) as KakaoUserResponse;
    console.info('[auth:kakao] /v2/user/me raw response', {
      status: userResponse.status,
      ok: userResponse.ok,
      body: JSON.stringify(kakaoUser, null, 2),
    });

    if (!userResponse.ok) {
      throw new BadRequestException('카카오 사용자 정보를 불러오지 못했습니다.');
    }

    return kakaoUser;
  }

  private async fetchKakaoShippingAddress(accessToken: string): Promise<KakaoShippingAddressResponse> {
    const shippingResponse = await fetch('https://kapi.kakao.com/v1/user/shipping_address', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const kakaoShipping = (await shippingResponse.json().catch(() => ({}))) as KakaoShippingAddressResponse;

    console.info('[auth:kakao] /v1/user/shipping_address raw response', {
      status: shippingResponse.status,
      ok: shippingResponse.ok,
      body: JSON.stringify(kakaoShipping, null, 2),
    });

    return kakaoShipping;
  }

  private parseKakaoProfile(
    kakaoUser: KakaoUserResponse,
    kakaoShipping: KakaoShippingAddressResponse,
  ): ParsedKakaoProfile {
    const providerUserId = String(kakaoUser.id ?? '').trim();
    if (!providerUserId) {
      console.warn('[auth:kakao] rejected by missing provider user id', {
        providerUserId,
      });
      throw new BadRequestException('카카오 사용자 정보를 불러오지 못했습니다.');
    }

    const kakaoProfile = kakaoUser.kakao_account?.profile;
    const kakaoName = kakaoUser.kakao_account?.name?.trim() || null;
    const kakaoNickname =
      kakaoProfile?.nickname?.trim() || kakaoUser.properties?.nickname?.trim() || null;
    const kakaoProfileImage =
      kakaoProfile?.profile_image_url || kakaoUser.properties?.profile_image || null;
    const kakaoThumbnailImage =
      kakaoProfile?.thumbnail_image_url || kakaoUser.properties?.thumbnail_image || null;
    const kakaoPhoneRaw = kakaoUser.kakao_account?.phone_number || null;
    const defaultShippingAddress =
      kakaoShipping.shipping_addresses?.find((item) => item.is_default) ??
      kakaoShipping.shipping_addresses?.[0] ??
      null;

    const address1 = defaultShippingAddress?.base_address?.trim() || null;
    const address2 = defaultShippingAddress?.detail_address?.trim() || null;
    const shippingZoneNumber = defaultShippingAddress?.zone_number?.trim() || null;
    const shippingName = defaultShippingAddress?.name?.trim() || null;
    const shippingReceiverName = defaultShippingAddress?.receiver_name?.trim() || null;
    const shippingReceiverPhone1 = defaultShippingAddress?.receiver_phone_number1?.trim() || null;
    const shippingReceiverPhone2 = defaultShippingAddress?.receiver_phone_number2?.trim() || null;
    const normalizedPhone = this.normalizeKakaoPhone(kakaoPhoneRaw ?? undefined);
    const displayName = kakaoName || kakaoNickname || '카카오회원';
    const email = kakaoUser.kakao_account?.email?.trim() || null;

    const parsed: ParsedKakaoProfile = {
      providerUserId,
      displayName,
      kakaoNickname,
      email,
      normalizedPhone,
      address1,
      address2,
      profileImageUrl: kakaoProfileImage,
      thumbnailImageUrl: kakaoThumbnailImage,
      shippingZoneNumber,
      shippingName,
      shippingReceiverName,
      shippingReceiverPhone1,
      shippingReceiverPhone2,
      consentNeedsAgreement: {
        name: kakaoUser.kakao_account?.name_needs_agreement,
        nickname: kakaoUser.kakao_account?.profile_nickname_needs_agreement,
        profileImage: kakaoUser.kakao_account?.profile_image_needs_agreement,
        phoneNumber: kakaoUser.kakao_account?.phone_number_needs_agreement,
        shippingAddress: kakaoShipping.shipping_addresses_needs_agreement,
      },
      shippingAddressCount: kakaoShipping.shipping_addresses?.length ?? 0,
      defaultShippingAddress,
    };

    console.info('[auth:kakao] parsed kakao consent data', {
      providerUserId: Number(parsed.providerUserId),
      name: kakaoName,
      nickname: kakaoNickname,
      profileImageUrl: parsed.profileImageUrl,
      thumbnailImageUrl: parsed.thumbnailImageUrl,
      phoneNumberRaw: kakaoPhoneRaw,
      phoneNumberNormalized: parsed.normalizedPhone,
      shippingZoneNumber: parsed.shippingZoneNumber,
      consentNeedsAgreement: parsed.consentNeedsAgreement,
      shippingAddressCount: parsed.shippingAddressCount,
      defaultShippingAddress: parsed.defaultShippingAddress,
    });

    return parsed;
  }

  private async upsertKakaoAccount(
    parsed: ParsedKakaoProfile,
    rawUser: KakaoUserResponse,
    rawShipping: KakaoShippingAddressResponse,
  ): Promise<{ account: AccountEntity; showSignupCouponPopup: boolean }> {
    let account = await this.accountRepository.findOne({
      where: {
        providerUserId: parsed.providerUserId,
      },
    });

    if (!account) {
      console.info('[auth:kakao] first login account provisioning start', {
        providerUserId: parsed.providerUserId,
      });

      const nextPhone = await this.resolveAvailableKakaoPhone(parsed.normalizedPhone, parsed.providerUserId);
      const userId = await this.buildUniqueKakaoUserId(`kakao_${parsed.providerUserId}`);

      account = await this.accountRepository.save(
        this.accountRepository.create({
          userId,
          username: userId,
          password: null,
          providerUserId: parsed.providerUserId,
          email: parsed.email,
          displayName: parsed.displayName,
          phone: nextPhone,
          address1: parsed.address1,
          address2: parsed.address2,
          status: 'active',
          statusReason: null,
          termsAgreed: true,
          termsAgreedAt: new Date(),
          phoneVerifiedAt: nextPhone ? new Date() : null,
          isActive: true,
        }),
      );

      console.info('[auth:kakao] first login account provisioning done', {
        providerUserId: parsed.providerUserId,
        accountId: account.id,
        userId: account.userId,
      });

      // 카카오 첫 로그인(신규 계정 생성)도 일반 회원가입과 동일하게 가입 쿠폰 1회 자동 발급
      const signupCoupon = await this.issueSignupCouponIfConfigured({
        accountId: account.id,
        phone: nextPhone,
        providerUserId: parsed.providerUserId,
      });

      console.info('[auth:kakao] first login signup coupon result', {
        accountId: account.id,
        providerUserId: parsed.providerUserId,
        issued: signupCoupon.issued,
        name: signupCoupon.name,
      });

      await this.upsertKakaoSnapshot(account.id, parsed, rawUser, rawShipping);

      return {
        account,
        showSignupCouponPopup: signupCoupon.issued,
      };
    }

    console.info('[auth:kakao] existing account found', {
      providerUserId: parsed.providerUserId,
      accountId: account.id,
      userId: account.userId,
      accountStatus: account.status,
      accountStatusReason: account.statusReason,
      isActive: account.isActive,
      showSignupCouponPopup: false,
    });

    let touched = false;

    if (!account.userId) {
      account.userId = await this.buildUniqueKakaoUserId(`kakao_${parsed.providerUserId}`);
      account.username = account.userId;
      touched = true;
    }

    if (parsed.displayName && account.displayName !== parsed.displayName) {
      account.displayName = parsed.displayName;
      touched = true;
    }

    if (parsed.email && account.email !== parsed.email) {
      account.email = parsed.email;
      touched = true;
    }

    if (parsed.address1 && account.address1 !== parsed.address1) {
      account.address1 = parsed.address1;
      touched = true;
    }

    if (parsed.address2 && account.address2 !== parsed.address2) {
      account.address2 = parsed.address2;
      touched = true;
    }

    if (parsed.normalizedPhone && account.phone !== parsed.normalizedPhone) {
      const existingByPhone = await this.accountRepository.findOne({
        where: { phone: parsed.normalizedPhone },
      });

      if (!existingByPhone || existingByPhone.id === account.id) {
        account.phone = parsed.normalizedPhone;
        account.phoneVerifiedAt = account.phoneVerifiedAt ?? new Date();
        touched = true;
      } else {
        console.info('[auth:kakao] existing account phone update skipped by conflict', {
          providerUserId: parsed.providerUserId,
          accountId: account.id,
          conflictedAccountId: existingByPhone.id,
        });
      }
    }

    if (touched) {
      account = await this.accountRepository.save(account);
      console.info('[auth:kakao] existing account updated', {
        providerUserId: parsed.providerUserId,
        accountId: account.id,
        userId: account.userId,
      });
    }

    await this.upsertKakaoSnapshot(account.id, parsed, rawUser, rawShipping);

    return {
      account,
      showSignupCouponPopup: false,
    };
  }

  private async resolveAvailableKakaoPhone(
    normalizedPhone: string | null,
    providerUserId: string,
  ): Promise<string | null> {
    if (!normalizedPhone) {
      return null;
    }

    const existingByPhone = await this.accountRepository.findOne({
      where: { phone: normalizedPhone },
    });

    if (existingByPhone) {
      console.info('[auth:kakao] phone conflict on first login, omit phone', {
        providerUserId,
        conflictedAccountId: existingByPhone.id,
      });
      return null;
    }

    return normalizedPhone;
  }

  private assertKakaoAccountActive(account: AccountEntity, providerUserId: string): void {
    if (account.status !== 'active' || !account.isActive) {
      console.warn('[auth:kakao] rejected by inactive status', {
        providerUserId,
        accountId: account.id,
        userId: account.userId,
        accountStatus: account.status,
        accountStatusReason: account.statusReason,
        isActive: account.isActive,
      });
      throw new BadRequestException('비활성화된 계정입니다. 고객센터로 문의해주세요.');
    }
  }

  async getProfile(userId: string) {
    const normalizedUserId = userId.trim().toLowerCase();
    const account = await this.findMemberAccountByUserId(normalizedUserId);

    if (!account) {
      throw new BadRequestException('회원 정보를 찾을 수 없습니다.');
    }

    let address1 = account.address1 ?? '';
    const address2 = account.address2 ?? '';

    // Backward compatibility: old rows may still have only legacy `address` populated.
    if (!address1) {
      try {
        const legacyRows = (await this.accountRepository.query(
          'SELECT address FROM accounts WHERE id = $1 LIMIT 1',
          [account.id],
        )) as Array<{ address?: string | null }>;
        const legacyAddress = legacyRows[0]?.address?.trim();
        if (legacyAddress) {
          address1 = legacyAddress;
        }
      } catch (error) {
        console.info('[auth:profile] legacy address column lookup skipped', {
          accountId: account.id,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const kakaoProfile = await this.accountKakaoRepository.findOne({ where: { accountId: account.id } });
    // Keep account type aligned with auth checks that use accounts.providerUserId.
    const inferredAccountType = account.providerUserId ? 'KAKAO' : 'NORMAL';

    return {
      profile: {
        id: account.id,
        userId: account.userId ?? '',
        accountType: inferredAccountType,
        name: account.displayName ?? '',
        phone: account.phone ?? '',
        createdAt: account.createdAt.toISOString(),
        address1,
        address2,
        kakaoNickname: kakaoProfile?.nickname ?? '',
        kakaoProfileImageUrl: kakaoProfile?.profileImageUrl ?? '',
        kakaoThumbnailImageUrl: kakaoProfile?.profileThumbnailUrl ?? '',
        kakaoShippingZoneNumber: account.postalCode ?? kakaoProfile?.shippingPostalCode ?? '',
        status: account.status,
        statusReason: account.statusReason,
      },
    };
  }

  async updateProfile(input: {
    userId: string;
    name: string;
    postalCode?: string;
    address1: string;
    address2: string;
    currentPassword?: string;
    newPassword?: string;
  }) {
    const userId = input.userId.trim().toLowerCase();
    const name = input.name.trim();
    const postalCode = input.postalCode?.trim();
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

    const account = await this.findMemberAccountByUserId(userId);

    if (!account) {
      throw new BadRequestException('회원 정보를 찾을 수 없습니다.');
    }

    if (!account.providerUserId) {
      if (!account.password || !currentPassword) {
        throw new BadRequestException('현재 비밀번호를 입력해주세요.');
      }

      const passwordMatched = await this.verifyPassword(currentPassword, account.password);
      if (!passwordMatched) {
        throw new BadRequestException('현재 비밀번호가 일치하지 않습니다.');
      }
    } else if (newPassword) {
      throw new BadRequestException('소셜 계정은 비밀번호를 변경할 수 없습니다.');
    }

    let nextPasswordHash = account.password;
    if (newPassword) {
      this.assertPasswordFormat(newPassword);
      nextPasswordHash = await this.hashPassword(newPassword);
    }

    account.displayName = name;
    account.postalCode = postalCode === undefined ? account.postalCode : (postalCode || null);
    account.address1 = address1;
    account.address2 = address2;
    account.password = nextPasswordHash;

    const updated = await this.accountRepository.save(account);

    return {
      profile: {
        id: updated.id,
        userId: updated.userId ?? '',
        accountType: updated.providerUserId ? 'KAKAO' : 'NORMAL',
        name: updated.displayName ?? '',
        phone: updated.phone ?? '',
        kakaoShippingZoneNumber: updated.postalCode ?? '',
        address1: updated.address1 ?? '',
        address2: updated.address2 ?? '',
      },
    };
  }

  async withdraw(input: { userId: string; password?: string; reason?: string }) {
    const userId = input.userId.trim().toLowerCase();
    const account = await this.findMemberAccountByUserId(userId);

    if (!account) {
      throw new BadRequestException('회원 정보를 찾을 수 없습니다.');
    }

    if (account.providerUserId) {
      await this.unlinkKakaoAccount(account.providerUserId ?? null, account.userId ?? userId);
    }

    await this.cleanupSignupCouponClaims(account);

    const deleted = await this.accountRepository.delete({ id: account.id });
    if ((deleted.affected ?? 0) < 1) {
      throw new BadRequestException('탈퇴 처리 중 계정 삭제에 실패했습니다. 다시 시도해주세요.');
    }

    return {
      ok: true,
      message: '탈퇴 처리되었습니다.',
    };
  }

  private async cleanupSignupCouponClaims(account: AccountEntity): Promise<void> {
    try {
      const qb = this.signupCouponClaimRepository
        .createQueryBuilder()
        .delete()
        .where('accountId = :accountId', { accountId: account.id });

      if (account.providerUserId?.trim()) {
        qb.orWhere('providerUserId = :providerUserId', {
          providerUserId: account.providerUserId.trim(),
        });
      }

      if (account.phone?.trim()) {
        qb.orWhere('phone = :phone', {
          phone: account.phone.trim(),
        });
      }

      const result = await qb.execute();
      console.info('[auth:signup-coupon] claim rows cleaned on withdraw', {
        accountId: account.id,
        affected: result.affected ?? 0,
      });
    } catch (error) {
      console.warn('[auth:signup-coupon] claim cleanup failed on withdraw', {
        accountId: account.id,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async logoutKakao(userId: string) {
    const normalizedUserId = userId.trim().toLowerCase();
    const account = await this.findMemberAccountByUserId(normalizedUserId);

    if (!account || !account.providerUserId) {
      return {
        ok: true,
        message: '카카오 로그아웃 처리되었습니다.',
      };
    }

    await this.logoutKakaoAccount(account.providerUserId ?? null, account.userId ?? normalizedUserId);

    return {
      ok: true,
      message: '카카오 로그아웃 처리되었습니다.',
    };
  }

  async completeKakaoProfile(input: {
    userId: string;
    postalCode: string;
    address1: string;
    address2: string;
  }) {
    const userId = input.userId.trim().toLowerCase();
    const postalCode = input.postalCode.trim();
    const address1 = input.address1.trim();
    const address2 = input.address2.trim();

    if (!address1) {
      throw new BadRequestException('주소를 입력해주세요.');
    }

    if (!postalCode) {
      throw new BadRequestException('우편번호를 입력해주세요.');
    }

    const account = await this.accountRepository.findOne({
      where: { userId },
    });

    if (!account) {
      throw new BadRequestException('카카오 회원 정보를 찾을 수 없습니다.');
    }

    account.address1 = address1;
    account.address2 = address2;
    account.postalCode = postalCode;
    account.termsAgreed = true;
    account.termsAgreedAt = account.termsAgreedAt ?? new Date();

    const updated = await this.accountRepository.save(account);

    const existingKakao = await this.accountKakaoRepository.findOne({
      where: { accountId: updated.id },
    });

    // 카카오 동의 항목이 일부만 있는 계정도 수동 입력 주소를 동일한 스키마로 보관합니다.
    await this.accountKakaoRepository.save(
      this.accountKakaoRepository.create({
        ...(existingKakao ?? {}),
        accountId: updated.id,
        providerUserId: updated.providerUserId ?? null,
        shippingName: existingKakao?.shippingName ?? 'manual',
        shippingReceiverName:
          existingKakao?.shippingReceiverName ?? updated.displayName ?? null,
        shippingReceiverPhone1:
          existingKakao?.shippingReceiverPhone1 ?? updated.phone ?? null,
        rawShipping: {
          source: 'manual',
          postalCode,
          address1,
          address2,
        },
        shippingPostalCode: postalCode,
        syncedAt: new Date(),
      }),
    );

    return {
      profile: {
        id: updated.id,
        userId: updated.userId ?? '',
        accountType: 'KAKAO',
        name: updated.displayName ?? '',
        phone: updated.phone ?? '',
        address1: updated.address1 ?? '',
        address2: updated.address2 ?? '',
      },
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

  private async findMemberAccountByUserId(userId: string): Promise<AccountEntity | null> {
    return this.accountRepository.findOne({
      where: { userId },
    });
  }

  private async buildUniqueKakaoUserId(baseUserId: string): Promise<string> {
    const normalizedBase = baseUserId.toLowerCase().replace(/[^a-z0-9._-]/g, '');

    const candidates = [normalizedBase, ...Array.from({ length: 20 }, (_, idx) => `${normalizedBase}_${idx + 1}`)];

    for (const candidate of candidates) {
      const existing = await this.accountRepository.findOne({ where: { userId: candidate } });
      if (!existing) {
        return candidate;
      }
    }

    return `${normalizedBase}_${randomBytes(4).toString('hex')}`;
  }

  private normalizeKakaoPhone(raw?: string): string | null {
    if (!raw) {
      return null;
    }

    const digitsOnly = raw.replace(/\D/g, '');
    if (!digitsOnly) {
      return null;
    }

    const localPhone = digitsOnly.startsWith('82') ? `0${digitsOnly.slice(2)}` : digitsOnly;

    if (!/^01\d{8,9}$/.test(localPhone)) {
      return null;
    }

    return localPhone;
  }

  private async upsertKakaoSnapshot(
    accountId: number,
    parsed: ParsedKakaoProfile,
    rawUser: KakaoUserResponse,
    rawShipping: KakaoShippingAddressResponse,
  ): Promise<void> {
    const existing = await this.accountKakaoRepository.findOne({ where: { accountId } });
    const payload = this.accountKakaoRepository.create({
      ...(existing ?? {}),
      accountId,
      providerUserId: parsed.providerUserId,
      rawUser: rawUser as unknown as Record<string, unknown>,
      rawShipping: rawShipping as unknown as Record<string, unknown>,
      nickname: parsed.kakaoNickname,
      profileImageUrl: parsed.profileImageUrl,
      profileThumbnailUrl: parsed.thumbnailImageUrl,
      shippingName: parsed.shippingName,
      shippingReceiverName: parsed.shippingReceiverName,
      shippingReceiverPhone1: parsed.shippingReceiverPhone1,
      shippingReceiverPhone2: parsed.shippingReceiverPhone2,
      shippingPostalCode: parsed.shippingZoneNumber,
      syncedAt: new Date(),
    });

    await this.accountKakaoRepository.save(payload);
  }

  private async unlinkKakaoAccount(providerUserId: string | null, userId: string): Promise<void> {
    if (!providerUserId) {
      console.warn('[auth:kakao] withdraw requested without providerUserId, skip unlink', { userId });
      return;
    }

    const kakaoAdminKey = process.env.KAKAO_ADMIN_KEY?.trim() || '';
    if (!kakaoAdminKey) {
      console.warn('[auth:kakao] KAKAO_ADMIN_KEY is missing, skip unlink', {
        userId,
        providerUserId,
      });
      return;
    }

    const unlinkResult = await postKakaoAdminUserAction({
      action: 'unlink',
      providerUserId,
      kakaoAdminKey,
    });

    const unlinkData = unlinkResult.data;

    if (!unlinkResult.ok) {
      console.error('[auth:kakao] unlink failed', {
        userId,
        providerUserId,
        status: unlinkResult.status,
        unlinkData,
      });
      throw new BadRequestException('카카오 연동 해제에 실패했습니다. 잠시 후 다시 시도해주세요.');
    }

    console.info('[auth:kakao] unlink success', {
      userId,
      providerUserId,
      unlinkData,
    });
  }

  private async logoutKakaoAccount(providerUserId: string | null, userId: string): Promise<void> {
    if (!providerUserId) {
      console.warn('[auth:kakao] logout requested without providerUserId, skip kakao logout', {
        userId,
      });
      return;
    }

    const kakaoAdminKey = process.env.KAKAO_ADMIN_KEY?.trim() || '';
    if (!kakaoAdminKey) {
      console.warn('[auth:kakao] KAKAO_ADMIN_KEY is missing, skip kakao logout', {
        userId,
        providerUserId,
      });
      return;
    }

    const logoutResult = await postKakaoAdminUserAction({
      action: 'logout',
      providerUserId,
      kakaoAdminKey,
    });

    const logoutData = logoutResult.data;

    if (!logoutResult.ok) {
      console.error('[auth:kakao] logout failed', {
        userId,
        providerUserId,
        status: logoutResult.status,
        logoutData,
      });
      return;
    }

    console.info('[auth:kakao] logout success', {
      userId,
      providerUserId,
      logoutData,
    });
  }
}