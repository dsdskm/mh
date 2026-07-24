import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppSettingEntity } from '../../../database/entities/app-setting.entity';
import { ProductEntity } from '../../../database/entities/product.entity';
import { TermsHistoryEntity } from '../../../database/entities/terms-history.entity';
import { ConfigRepository } from '../repositories/config.repository';
import {
  StoreConfig,
  StoreRecipe,
  StoreStoryImage,
  StoreTermsHistoryItem,
} from '../../../shared/store.types';

@Injectable()
export class ConfigService implements OnModuleInit {
  constructor(
    private readonly configRepository: ConfigRepository,
    @InjectRepository(ProductEntity)
    private readonly productRepository: Repository<ProductEntity>,
    @InjectRepository(TermsHistoryEntity)
    private readonly termsHistoryRepository: Repository<TermsHistoryEntity>,
  ) {}

  async onModuleInit(): Promise<void> {
    const count = await this.configRepository.count();

    if (count > 0) {
      return;
    }

    await this.configRepository.save(
      this.configRepository.create(this.buildInitialSetting()),
    );
  }

  async getStoreConfig(): Promise<StoreConfig> {
    const setting = await this.configRepository.findFirst();

    if (!setting) {
      const created = await this.configRepository.save(
        this.configRepository.create(this.buildInitialSetting()),
      );

      return this.resolveBonusProductName(await this.mapSetting(created));
    }

    return this.resolveBonusProductName(await this.mapSetting(setting));
  }

  async updateStoreConfig(input: Partial<StoreConfig>): Promise<StoreConfig> {
    const existing = await this.configRepository.findFirst();

    const base = existing
      ? existing
      : await this.configRepository.save(
          this.configRepository.create(this.buildInitialSetting()),
        );

    const currentHistory = await this.loadTermsHistory(base.id);
    const currentTermsUrl =
      currentHistory.find((item) => item.documentType === 'terms')?.documentUrl ??
      '';
    const currentPrivacyUrl =
      currentHistory.find((item) => item.documentType === 'privacy')
        ?.documentUrl ?? '';

    const nextTermsUrl =
      typeof input.termsUrl === 'string'
        ? this.normalizeTermsUrl(input.termsUrl)
        : currentTermsUrl;
    const nextPrivacyUrl =
      typeof input.privacyUrl === 'string'
        ? this.normalizeTermsUrl(input.privacyUrl)
        : currentPrivacyUrl;
    const nextKakaoChannelUrl =
      typeof input.kakaoChannelUrl === 'string'
        ? this.normalizeTermsUrl(input.kakaoChannelUrl)
        : base.kakaoChannelUrl ?? '';

    const termsChanged = nextTermsUrl !== currentTermsUrl;
    const privacyChanged = nextPrivacyUrl !== currentPrivacyUrl;
    const now = new Date();

    const merged = this.configRepository.merge(base, {
      shopName: input.shopName ?? base.shopName,
      sellerName: input.sellerName ?? base.sellerName,
      sellerPhone: input.sellerPhone ?? base.sellerPhone,
      trusteeBusinessName:
        input.trusteeBusinessName ?? base.trusteeBusinessName,
      trusteeBusinessNumber:
        input.trusteeBusinessNumber ?? base.trusteeBusinessNumber,
      trusteeRepresentative:
        input.trusteeRepresentative ?? base.trusteeRepresentative,
      trusteePhone: input.trusteePhone ?? base.trusteePhone,
      origin: input.origin ?? base.origin,
      bankName: input.bankName ?? base.bankName,
      accountNumber: input.accountNumber ?? base.accountNumber,
      accountHolder: input.accountHolder ?? base.accountHolder,
      transferNote: input.transferNote ?? base.transferNote,
      detailDescription: input.detailDescription ?? base.detailDescription,
      shippingRefundPolicy:
        input.shippingRefundPolicy ?? base.shippingRefundPolicy,
      storyImages: input.storyImages ?? base.storyImages,
      videoUrl: input.videoUrl ?? base.videoUrl,
      kakaoChannelUrl: nextKakaoChannelUrl,
      recipes: input.recipes ?? base.recipes,
      paymentDueDays:
        input.paymentDueDays === undefined
          ? base.paymentDueDays
          : Math.max(0, Math.floor(Number(input.paymentDueDays) || 0)),
      deliveryFee:
        input.deliveryFee === undefined
          ? base.deliveryFee
          : Math.max(0, Math.floor(Number(input.deliveryFee) || 0)),
      chargeDeliveryFee:
        input.chargeDeliveryFee === undefined
          ? base.chargeDeliveryFee
          : Boolean(input.chargeDeliveryFee),
      memberBonusProductId:
        input.memberBonusProductId === undefined
          ? base.memberBonusProductId
          : Math.floor(Number(input.memberBonusProductId)) > 0
            ? Math.floor(Number(input.memberBonusProductId))
            : null,
      signupCouponTemplateId:
        input.signupCouponTemplateId === undefined
          ? base.signupCouponTemplateId
          : Math.floor(Number(input.signupCouponTemplateId)) > 0
            ? Math.floor(Number(input.signupCouponTemplateId))
            : null,
      mileageEarnRate:
        input.mileageEarnRate === undefined
          ? base.mileageEarnRate
          : Math.max(0, Math.floor(Number(input.mileageEarnRate) || 0)),
      businessStatus:
        input.businessStatus === 'standby' ||
        input.businessStatus === 'closed' ||
        input.businessStatus === 'open'
          ? input.businessStatus
          : base.businessStatus,
      businessStatusOpenText:
        input.businessStatusOpenText === undefined
          ? base.businessStatusOpenText
          : String(input.businessStatusOpenText).trim(),
      businessStatusStandbyText:
        input.businessStatusStandbyText === undefined
          ? base.businessStatusStandbyText
          : String(input.businessStatusStandbyText).trim(),
      businessStatusClosedText:
        input.businessStatusClosedText === undefined
          ? base.businessStatusClosedText
          : String(input.businessStatusClosedText).trim(),
    });

    const saved = await this.configRepository.save(merged);

    if (termsChanged && saved.id && nextTermsUrl) {
      await this.termsHistoryRepository.save(
        this.termsHistoryRepository.create({
          appSettingId: saved.id,
          documentType: 'terms',
          documentUrl: nextTermsUrl,
          termsVersion: this.formatTermsVersion(now),
          termsUpdatedAt: now,
        }),
      );
    }

    if (privacyChanged && saved.id && nextPrivacyUrl) {
      await this.termsHistoryRepository.save(
        this.termsHistoryRepository.create({
          appSettingId: saved.id,
          documentType: 'privacy',
          documentUrl: nextPrivacyUrl,
          termsVersion: this.formatTermsVersion(now),
          termsUpdatedAt: now,
        }),
      );
    }

    return this.resolveBonusProductName(await this.mapSetting(saved));
  }

  // 사은품 상품명을 조회해 응답에 채운다. 숨김(비노출) 상품도 이름을 노출하기 위해 active 조건은 두지 않는다.
  private async resolveBonusProductName(
    config: StoreConfig,
  ): Promise<StoreConfig> {
    if (!config.memberBonusProductId) {
      return { ...config, memberBonusProductName: null };
    }

    const product = await this.productRepository.findOne({
      where: { id: config.memberBonusProductId },
      select: { name: true },
    });

    return { ...config, memberBonusProductName: product?.name ?? null };
  }

  private buildInitialSetting(): Partial<AppSettingEntity> {
    return {
      shopName: '',
      sellerName: '',
      sellerPhone: '',
      trusteeBusinessName: '',
      trusteeBusinessNumber: '',
      trusteeRepresentative: '',
      trusteePhone: '',
      origin: '',
      bankName: '',
      accountNumber: '',
      accountHolder: '',
      transferNote: '',
      detailDescription: '',
      shippingRefundPolicy: '',
      storyImages: [],
      videoUrl: '',
      kakaoChannelUrl: '',
      recipes: [],
      paymentDueDays: 0,
      deliveryFee: 0,
      chargeDeliveryFee: false,
      memberBonusProductId: null,
      signupCouponTemplateId: null,
      mileageEarnRate: 0,
      businessStatus: 'open',
      businessStatusOpenText: '현재 정상 영업 중입니다.',
      businessStatusStandbyText: '영업 준비 중입니다. 잠시 후 다시 방문해주세요.',
      businessStatusClosedText: '영업이 종료되었습니다. 다음 영업 시간에 주문 가능합니다.',
    };
  }

  private async mapSetting(setting: AppSettingEntity): Promise<StoreConfig> {
    const termsHistory = await this.loadTermsHistory(setting.id);
    const latestTerms =
      termsHistory.find((item) => item.documentType === 'terms') ?? null;
    const latestPrivacy =
      termsHistory.find((item) => item.documentType === 'privacy') ?? null;

    return {
      shopName: setting.shopName,
      sellerName: setting.sellerName,
      sellerPhone: setting.sellerPhone,
      trusteeBusinessName: setting.trusteeBusinessName ?? '',
      trusteeBusinessNumber: setting.trusteeBusinessNumber ?? '',
      trusteeRepresentative: setting.trusteeRepresentative ?? '',
      trusteePhone: setting.trusteePhone ?? '',
      origin: setting.origin,
      bankName: setting.bankName,
      accountNumber: setting.accountNumber,
      accountHolder: setting.accountHolder,
      transferNote: setting.transferNote,
      detailDescription: setting.detailDescription,
      shippingRefundPolicy: setting.shippingRefundPolicy ?? '',
      storyImages: setting.storyImages as StoreStoryImage[],
      videoUrl: setting.videoUrl,
      kakaoChannelUrl: setting.kakaoChannelUrl ?? '',
      termsUrl: latestTerms?.documentUrl ?? '',
      privacyUrl: latestPrivacy?.documentUrl ?? '',
      termsVersion: latestTerms?.termsVersion ?? '',
      termsUpdatedAt: latestTerms?.termsUpdatedAt ?? null,
      termsHistory,
      recipes: setting.recipes as StoreRecipe[],
      paymentDueDays: setting.paymentDueDays ?? 0,
      deliveryFee: setting.deliveryFee ?? 0,
      chargeDeliveryFee: setting.chargeDeliveryFee ?? false,
      memberBonusProductId: setting.memberBonusProductId ?? null,
      memberBonusProductName: null,
      signupCouponTemplateId: setting.signupCouponTemplateId ?? null,
      mileageEarnRate: setting.mileageEarnRate ?? 0,
      businessStatus: this.normalizeBusinessStatus(setting.businessStatus),
      businessStatusOpenText:
        setting.businessStatusOpenText?.trim() || '현재 정상 영업 중입니다.',
      businessStatusStandbyText:
        setting.businessStatusStandbyText?.trim() || '영업 준비 중입니다. 잠시 후 다시 방문해주세요.',
      businessStatusClosedText:
        setting.businessStatusClosedText?.trim() || '영업이 종료되었습니다. 다음 영업 시간에 주문 가능합니다.',
    };
  }

  private async loadTermsHistory(
    appSettingId: number,
  ): Promise<StoreTermsHistoryItem[]> {
    const rows = await this.termsHistoryRepository.find({
      where: { appSettingId },
      order: {
        termsUpdatedAt: 'DESC',
        id: 'DESC',
      },
      take: 100,
    });

    if (rows.length > 0) {
      return rows.map((row) => ({
        documentType:
          row.documentType === 'privacy' ? 'privacy' : 'terms',
        documentUrl: this.normalizeTermsUrl(row.documentUrl),
        termsVersion: row.termsVersion,
        termsUpdatedAt: row.termsUpdatedAt.toISOString(),
      }));
    }

    return [];
  }

  private normalizeBusinessStatus(status: unknown): 'open' | 'standby' | 'closed' {
    if (status === 'standby' || status === 'closed' || status === 'open') {
      return status;
    }

    return 'open';
  }

  private normalizeTermsUrl(raw: string): string {
    const trimmed = raw.trim();
    if (!trimmed) {
      return '';
    }

    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return '';
      }

      return parsed.toString();
    } catch {
      return '';
    }
  }

  private formatTermsVersion(value: Date): string {
    const year = value.getFullYear().toString();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    const hour = String(value.getHours()).padStart(2, '0');
    const minute = String(value.getMinutes()).padStart(2, '0');
    return `${year}${month}${day}${hour}${minute}`;
  }
}
