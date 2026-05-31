import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppSettingEntity } from '../../database/entities/app-setting.entity';
import {
  StoreConfig,
  StoreRecipe,
  StoreStoryImage,
} from '../../shared/store.types';

@Injectable()
export class ConfigService implements OnModuleInit {
  constructor(
    @InjectRepository(AppSettingEntity)
    private readonly appSettingRepository: Repository<AppSettingEntity>,
  ) {}

  async onModuleInit(): Promise<void> {
    const count = await this.appSettingRepository.count();

    if (count > 0) {
      return;
    }

    await this.appSettingRepository.save(
      this.appSettingRepository.create(this.buildInitialSetting()),
    );
  }

  async getStoreConfig(): Promise<StoreConfig> {
    const [setting] = await this.appSettingRepository.find({
      order: { id: 'ASC' },
      take: 1,
    });

    if (!setting) {
      const created = await this.appSettingRepository.save(
        this.appSettingRepository.create(this.buildInitialSetting()),
      );

      return this.mapSetting(created);
    }

    return this.mapSetting(setting);
  }

  async updateStoreConfig(input: Partial<StoreConfig>): Promise<StoreConfig> {
    const [existing] = await this.appSettingRepository.find({
      order: { id: 'ASC' },
      take: 1,
    });

    const base = existing
      ? existing
      : this.appSettingRepository.create(this.buildInitialSetting());

    const merged = this.appSettingRepository.merge(base, {
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
      recipes: input.recipes ?? base.recipes,
    });

    const saved = await this.appSettingRepository.save(merged);
    return this.mapSetting(saved);
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
      recipes: this.parseJsonEnv<StoreRecipe[]>('RECIPES', []),
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
      recipes: setting.recipes as StoreRecipe[],
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
}
