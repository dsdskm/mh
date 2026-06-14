import { Injectable } from '@nestjs/common';

@Injectable()
export class HealthService {
  getHealth() {
    return {
      ok: true,
      timestamp: new Date().toISOString(),
      service: 'corn-shop-api',
    };
  }
}
