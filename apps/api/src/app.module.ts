import * as path from 'node:path';
import { existsSync } from 'node:fs';
import * as dotenv from 'dotenv';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountsController } from './features/accounts/controllers/accounts.controller';
import { AccountsService } from './features/accounts/services/accounts.service';
import { AccountRepository } from './features/accounts/repositories/account.repository';
import { UploadService } from './features/accounts/services/upload.service';
import { ConfigController } from './features/config/controllers/config.controller';
import { ConfigService } from './features/config/services/config.service';
import { ConfigRepository } from './features/config/repositories/config.repository';
import { HealthController } from './features/health/controllers/health.controller';
import { HealthService } from './features/health/services/health.service';
import { AuthController } from './features/auth/controllers/auth.controller';
import { AuthService } from './features/auth/services/auth.service';
import { InquiriesController } from './features/inquiries/controllers/inquiries.controller';
import { InquiriesService } from './features/inquiries/services/inquiries.service';
import { NoticesController } from './features/notices/controllers/notices.controller';
import { NoticesService } from './features/notices/services/notices.service';
import { OrdersController } from './features/orders/controllers/orders.controller';
import { OrdersService } from './features/orders/services/orders.service';
import { ProductsController } from './features/products/controllers/products.controller';
import { ProductsService } from './features/products/services/products.service';
import { ReviewsController } from './features/reviews/controllers/reviews.controller';
import { ReviewsService } from './features/reviews/services/reviews.service';
import { NotificationsController } from './features/notifications/controllers/notifications.controller';
import { NotificationsService } from './features/notifications/services/notifications.service';
import { CouponsController } from './features/coupons/controllers/coupons.controller';
import { CouponsService } from './features/coupons/services/coupons.service';
import { MileageController } from './features/mileage/controllers/mileage.controller';
import { MileageService } from './features/mileage/services/mileage.service';
import { MessagesController } from './features/messages/controllers/messages.controller';
import { MessagesService } from './features/messages/services/messages.service';
import { PopbillSmsClient } from './features/messages/services/popbill-sms.client';

import { AccountEntity } from './database/entities/account.entity';
import { AppSettingEntity } from './database/entities/app-setting.entity';
import { InquiryEntity } from './database/entities/inquiry.entity';
import { InquiryCommentEntity } from './database/entities/inquiry-comment.entity';
import { NoticeEntity } from './database/entities/notice.entity';
import { OrderItemEntity } from './database/entities/order-item.entity';
import { OrderEntity } from './database/entities/order.entity';
import { ProductEntity } from './database/entities/product.entity';
import { ReviewCommentEntity } from './database/entities/review-comment.entity';
import { ReviewEntity } from './database/entities/review.entity';
import { AccountShippingAddressEntity } from './database/entities/account-shipping-address.entity';
import { NotificationEntity } from './database/entities/notification.entity';
import { CouponEntity } from './database/entities/coupon.entity';
import { CouponTemplateEntity } from './database/entities/coupon-template.entity';
import { MileageTransactionEntity } from './database/entities/mileage-transaction.entity';
import { AdminSmsHistoryEntity } from './database/entities/admin-sms-history.entity';
import { TermsHistoryEntity } from './database/entities/terms-history.entity';
import { FirestoreTriggerService } from './shared/firestore-trigger.service';
import { AdminAuthService } from './shared/auth/admin-auth.service';
import { BackofficeAuthGuard } from './shared/auth/backoffice-auth.guard';

function loadEnvFiles() {
  const candidates = [
    path.resolve(process.cwd(), 'apps/api/.env'),
    path.resolve(process.cwd(), '.env'),
    path.resolve(__dirname, '../.env'),
    path.resolve(__dirname, '../../../.env'),
  ];

  for (const filePath of candidates) {
    if (existsSync(filePath)) {
      dotenv.config({ path: filePath, override: false });
    }
  }
}

loadEnvFiles();

const databaseUrl =
  process.env.DATABASE_URL ?? 'postgresql://root:root@localhost:5432/main';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: databaseUrl,
      synchronize: true,
      autoLoadEntities: true,
      entities: [
        AccountEntity,
        AccountShippingAddressEntity,
        AppSettingEntity,
        ProductEntity,
        NoticeEntity,
        OrderEntity,
        OrderItemEntity,
        InquiryEntity,
        InquiryCommentEntity,
        ReviewEntity,
        ReviewCommentEntity,
        NotificationEntity,
        CouponEntity,
        CouponTemplateEntity,
        MileageTransactionEntity,
        AdminSmsHistoryEntity,
        TermsHistoryEntity,
      ],
    }),
    TypeOrmModule.forFeature([
      AccountEntity,
      AccountShippingAddressEntity,
      AppSettingEntity,
      ProductEntity,
      NoticeEntity,
      OrderEntity,
      OrderItemEntity,
      InquiryEntity,
      InquiryCommentEntity,
      ReviewEntity,
      ReviewCommentEntity,
      NotificationEntity,
      CouponEntity,
      CouponTemplateEntity,
      MileageTransactionEntity,
      AdminSmsHistoryEntity,
      TermsHistoryEntity,
    ]),
  ],
  controllers: [
    HealthController,
    AuthController,
    ConfigController,
    ProductsController,
    OrdersController,
    InquiriesController,
    NoticesController,
    ReviewsController,
    NotificationsController,
    AccountsController,
    CouponsController,
    MileageController,
    MessagesController,
  ],
  providers: [
    HealthService,
    AuthService,
    ConfigService,
    ConfigRepository,
    ProductsService,
    OrdersService,
    InquiriesService,
    NoticesService,
    ReviewsService,
    NotificationsService,
    AccountRepository,
    AccountsService,
    UploadService,
    CouponsService,
    MileageService,
    MessagesService,
    PopbillSmsClient,
    FirestoreTriggerService,
    AdminAuthService,
    {
      provide: APP_GUARD,
      useClass: BackofficeAuthGuard,
    },
  ],
})
export class AppModule {}
