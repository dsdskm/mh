import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppSettingEntity } from '../../../database/entities/app-setting.entity';
import { ProductEntity } from '../../../database/entities/product.entity';
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

      return this.resolveBonusProductName(this.mapSetting(created));
    }

    return this.resolveBonusProductName(this.mapSetting(setting));
  }

  async updateStoreConfig(input: Partial<StoreConfig>): Promise<StoreConfig> {
    const existing = await this.configRepository.findFirst();

    const base = existing
      ? existing
      : this.configRepository.create(this.buildInitialSetting());
    const nextTermsUrl =
      typeof input.termsUrl === 'string'
        ? this.normalizeTermsUrl(input.termsUrl)
        : this.normalizeTermsUrl(base.termsUrl ?? '');
    const termsChanged = nextTermsUrl !== (base.termsUrl ?? '');
    const now = termsChanged ? new Date() : null;
    const nextTermsHistory = termsChanged
      ? this.buildTermsHistory(
          base.termsHistory,
          nextTermsUrl,
          now,
        )
      : (base.termsHistory ?? []);

    const merged = this.configRepository.merge(base, {
      shopName: input.shopName ?? base.shopName,
      sellerName: input.sellerName ?? base.sellerName,
      sellerPhone: input.sellerPhone ?? base.sellerPhone,
      origin: input.origin ?? base.origin,
      bankName: input.bankName ?? base.bankName,
      accountNumber: input.accountNumber ?? base.accountNumber,
      accountHolder: input.accountHolder ?? base.accountHolder,
      transferNote: input.transferNote ?? base.transferNote,
      detailDescription: input.detailDescription ?? base.detailDescription,
      storyImages: input.storyImages ?? base.storyImages,
      videoUrl: input.videoUrl ?? base.videoUrl,
      termsUrl: nextTermsUrl,
      termsVersion: termsChanged
        ? (now ? this.formatTermsVersion(now) : base.termsVersion ?? '')
        : (base.termsVersion ?? ''),
      termsUpdatedAt: termsChanged ? now : (base.termsUpdatedAt ?? null),
      termsHistory: nextTermsHistory,
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
      mileageEarnRate:
        input.mileageEarnRate === undefined
          ? base.mileageEarnRate
          : Math.max(0, Math.floor(Number(input.mileageEarnRate) || 0)),
    });

    const saved = await this.configRepository.save(merged);
    return this.resolveBonusProductName(this.mapSetting(saved));
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
      shopName: process.env.SHOP_NAME ?? '',
      sellerName: process.env.SELLER_NAME ?? '',
      sellerPhone: process.env.SELLER_PHONE ?? '',
      origin: process.env.SELLER_ORIGIN ?? '',
      bankName: process.env.BANK_NAME ?? '',
      accountNumber: process.env.BANK_ACCOUNT ?? '',
      accountHolder: process.env.BANK_HOLDER ?? '',
      transferNote: process.env.TRANSFER_NOTE ?? '',
      detailDescription: process.env.DETAIL_DESCRIPTION ?? '',
      storyImages: this.parseJsonEnv<StoreStoryImage[]>('STORY_IMAGES', []),
      videoUrl: process.env.PRODUCT_VIDEO_URL ?? '',
      termsUrl: this.normalizeTermsUrl(process.env.TERMS_URL ?? ''),
      termsVersion: process.env.TERMS_VERSION ?? '',
      termsUpdatedAt: null,
      termsHistory: [],
      recipes: this.parseJsonEnv<StoreRecipe[]>('RECIPES', []),
      paymentDueDays: Number(process.env.PAYMENT_DUE_DAYS ?? 0) || 0,
      deliveryFee: Number(process.env.DELIVERY_FEE ?? 0) || 0,
      chargeDeliveryFee: process.env.CHARGE_DELIVERY_FEE === 'true',
      memberBonusProductId:
        Number(process.env.MEMBER_BONUS_PRODUCT_ID ?? 0) || null,
      mileageEarnRate: Number(process.env.MILEAGE_EARN_RATE ?? 0) || 0,
    };
  }

  private mapSetting(setting: AppSettingEntity): StoreConfig {
    return {
      shopName: setting.shopName,
      sellerName: setting.sellerName,
      sellerPhone: setting.sellerPhone,
      origin: setting.origin,
      bankName: setting.bankName,
      accountNumber: setting.accountNumber,
      accountHolder: setting.accountHolder,
      transferNote: setting.transferNote,
      detailDescription: setting.detailDescription,
      storyImages: setting.storyImages as StoreStoryImage[],
      videoUrl: setting.videoUrl,
      termsUrl: this.normalizeTermsUrl(setting.termsUrl ?? ''),
      termsVersion: setting.termsVersion ?? '',
      termsUpdatedAt: setting.termsUpdatedAt
        ? setting.termsUpdatedAt.toISOString()
        : null,
      termsHistory: this.mapTermsHistory(setting.termsHistory),
      recipes: setting.recipes as StoreRecipe[],
      paymentDueDays: setting.paymentDueDays ?? 0,
      deliveryFee: setting.deliveryFee ?? 0,
      chargeDeliveryFee: setting.chargeDeliveryFee ?? false,
      memberBonusProductId: setting.memberBonusProductId ?? null,
      memberBonusProductName: null,
      mileageEarnRate: setting.mileageEarnRate ?? 0,
    };
  }

  private parseJsonEnv<T>(name: string, fallback: T): T {
    const raw = process.env[name];
    if (!raw) {
      return fallback;
    }

    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }

  private mapTermsHistory(
    history: unknown,
  ): StoreTermsHistoryItem[] {
    if (!Array.isArray(history)) {
      return [];
    }

    return history
      .map((item) => {
        if (!item || typeof item !== 'object') {
          return null;
        }

        const entry = item as Record<string, unknown>;
        const termsUrl =
          typeof entry.termsUrl === 'string'
            ? this.normalizeTermsUrl(entry.termsUrl)
            : '';
        const termsVersion =
          typeof entry.termsVersion === 'string' ? entry.termsVersion : '';
        const termsUpdatedAt =
          typeof entry.termsUpdatedAt === 'string' ? entry.termsUpdatedAt : '';

        if (!termsUrl || !termsVersion || !termsUpdatedAt) {
          return null;
        }

        return {
          termsUrl,
          termsVersion,
          termsUpdatedAt,
        } as StoreTermsHistoryItem;
      })
      .filter((item): item is StoreTermsHistoryItem => item !== null)
      .slice(0, 100);
  }

  private buildTermsHistory(
    current: unknown,
    nextTermsUrl: string,
    changedAt: Date | null,
  ): StoreTermsHistoryItem[] {
    if (!nextTermsUrl || !changedAt) {
      return this.mapTermsHistory(current);
    }

    const prev = this.mapTermsHistory(current);
    const nextVersion = this.formatTermsVersion(changedAt);

    const nextEntry: StoreTermsHistoryItem = {
      termsUrl: nextTermsUrl,
      termsVersion: nextVersion,
      termsUpdatedAt: changedAt.toISOString(),
    };

    const deduped = prev.filter(
      (item) =>
        item.termsVersion !== nextVersion &&
        !(item.termsUrl === nextEntry.termsUrl &&
          item.termsVersion === nextEntry.termsVersion),
    );

    return [nextEntry, ...deduped].slice(0, 100);
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
