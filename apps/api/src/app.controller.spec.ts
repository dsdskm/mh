import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './features/health/controllers/health.controller';
import { HealthService } from './features/health/services/health.service';

describe('HealthController', () => {
  let appController: HealthController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [HealthService],
    }).compile();

    appController = app.get<HealthController>(HealthController);
  });

  describe('health', () => {
    it('should return ok status', () => {
      const result = appController.health();
      expect(result.ok).toBe(true);
      expect(result.service).toBe('corn-shop-api');
    });
  });
});
