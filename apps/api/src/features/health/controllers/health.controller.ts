import { Controller, Get } from '@nestjs/common';
import { HealthService } from '../services/health.service';

@Controller('api')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('health')
  health() {
    return this.healthService.getHealth();
  }
}
