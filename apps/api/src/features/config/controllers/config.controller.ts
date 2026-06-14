import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ConfigService } from '../services/config.service';
import { StoreConfig } from '../../../shared/store.types';

@Controller('api')
export class ConfigController {
  constructor(private readonly configService: ConfigService) {}

  @Get('config')
  getConfig() {
    return this.configService.getStoreConfig();
  }

  @Get('backoffice/config')
  getBackofficeConfig() {
    return this.configService.getStoreConfig();
  }

  @Patch('backoffice/config')
  updateBackofficeConfig(@Body() body: Partial<StoreConfig>) {
    return this.configService.updateStoreConfig(body);
  }
}
