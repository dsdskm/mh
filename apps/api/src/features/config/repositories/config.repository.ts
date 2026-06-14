import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppSettingEntity } from '../../../database/entities/app-setting.entity';

@Injectable()
export class ConfigRepository {
  constructor(
    @InjectRepository(AppSettingEntity)
    private readonly appSettingRepository: Repository<AppSettingEntity>,
  ) {}

  count(): Promise<number> {
    return this.appSettingRepository.count();
  }

  async findFirst(): Promise<AppSettingEntity | null> {
    const [setting] = await this.appSettingRepository.find({
      order: { id: 'ASC' },
      take: 1,
    });

    return setting ?? null;
  }

  create(input: Partial<AppSettingEntity>): AppSettingEntity {
    return this.appSettingRepository.create(input);
  }

  merge(base: AppSettingEntity, input: Partial<AppSettingEntity>): AppSettingEntity {
    return this.appSettingRepository.merge(base, input);
  }

  save(entity: AppSettingEntity): Promise<AppSettingEntity> {
    return this.appSettingRepository.save(entity);
  }
}
