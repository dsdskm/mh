import * as path from 'node:path';
import * as dotenv from 'dotenv';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './features/admin/admin.controller';
import { AdminService } from './features/admin/admin.service';
import { ConfigController } from './features/config/config.controller';
import { ConfigService } from './features/config/config.service';
import { HealthController } from './features/health/health.controller';
import { HealthService } from './features/health/health.service';
import { AuthController } from './features/auth/auth.controller';
import { AuthService } from './features/auth/auth.service';
import { InquiriesController } from './features/inquiries/inquiries.controller';
import { InquiriesService } from './features/inquiries/inquiries.service';
import { OrdersController } from './features/orders/orders.controller';
import { OrdersService } from './features/orders/orders.service';
import { ProductsController } from './features/products/products.controller';
import { ProductsService } from './features/products/products.service';
import { ReviewsController } from './features/reviews/reviews.controller';
import { ReviewsService } from './features/reviews/reviews.service';
import { AccountEntity } from './database/entities/account.entity';
import { AppSettingEntity } from './database/entities/app-setting.entity';
import { InquiryEntity } from './database/entities/inquiry.entity';
import { OrderItemEntity } from './database/entities/order-item.entity';
import { OrderEntity } from './database/entities/order.entity';
import { ProductEntity } from './database/entities/product.entity';
import { ReviewCommentEntity } from './database/entities/review-comment.entity';
import { ReviewEntity } from './database/entities/review.entity';
import { AccountShippingAddressEntity } from './database/entities/account-shipping-address.entity';

dotenv.config({
  path: path.resolve(__dirname, '../../../.env'),
});

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
        OrderEntity,
        OrderItemEntity,
        InquiryEntity,
        ReviewEntity,
        ReviewCommentEntity,
      ],
    }),
    TypeOrmModule.forFeature([
      AccountEntity,
      AccountShippingAddressEntity,
      AppSettingEntity,
      ProductEntity,
      OrderEntity,
      OrderItemEntity,
      InquiryEntity,
      ReviewEntity,
      ReviewCommentEntity,
    ]),
  ],
  controllers: [
    HealthController,
    AuthController,
    ConfigController,
    ProductsController,
    OrdersController,
    InquiriesController,
    ReviewsController,
    AdminController,
  ],
  providers: [
    HealthService,
    AuthService,
    ConfigService,
    ProductsService,
    OrdersService,
    InquiriesService,
    ReviewsService,
    AdminService,
  ],
})
export class AppModule {}
