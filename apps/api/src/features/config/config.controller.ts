import { Controller, Get } from '@nestjs/common';
import { ConfigService } from './config.service';

@Controller('api')
export class ConfigController {
  constructor(private readonly configService: ConfigService) {}

  @Get('config')
  getConfig() {
    return this.configService.getStoreConfig();
  }
}
