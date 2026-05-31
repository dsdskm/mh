import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccountEntity, AccountType } from '../../database/entities/account.entity';
import { ConfigService } from '../config/config.service';
import { InquiriesService } from '../inquiries/inquiries.service';
import { OrdersService } from '../orders/orders.service';
import { ProductsService } from '../products/products.service';
import { ReviewsService } from '../reviews/reviews.service';
import {
  CreateProductInput,
  OrderStatus,
  StoreConfig,
  UpdateProductInput,
} from '../../shared/store.types';

@Injectable()
export class AdminService implements OnModuleInit {
  constructor(
    @InjectRepository(AccountEntity)
    private readonly accountRepository: Repository<AccountEntity>,
    private readonly ordersService: OrdersService,
    private readonly productsService: ProductsService,
    private readonly inquiriesService: InquiriesService,
    private readonly reviewsService: ReviewsService,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    const existingMaster = await this.accountRepository.findOne({
      where: {
        type: 'MASTER',
        userId: 'dsdskm',
      },
    });

    if (existingMaster) {
      return;
    }

    await this.accountRepository.save(
      this.accountRepository.create({
        type: 'MASTER',
        userId: 'dsdskm',
        password: 'q1w2e3r4',
        displayName: 'Master Admin',
        isActive: true,
      }),
    );
  }

  async login(userId: string, password: string): Promise<boolean> {
    const matched = await this.accountRepository.find({
      where: {
        userId,
        password,
        isActive: true,
      },
    });

    return matched.some((account) => account.type.toLowerCase() === 'master');
  }

  getAccounts() {
    return this.accountRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async createAccount(input: {
    type: AccountType;
    userId?: string;
    username?: string;
    password?: string;
    providerUserId?: string;
    email?: string;
    displayName?: string;
    isActive?: boolean;
  }) {
    const account = this.accountRepository.create({
      type: input.type,
      userId: input.userId ?? null,
      username: input.username ?? null,
      password: input.password ?? null,
      providerUserId: input.providerUserId ?? null,
      email: input.email ?? null,
      displayName: input.displayName ?? null,
      isActive: input.isActive ?? true,
    });

    return this.accountRepository.save(account);
  }

  async updateAccount(
    id: number,
    input: {
      type?: AccountType;
      userId?: string;
      username?: string;
      password?: string;
      providerUserId?: string;
      email?: string;
      displayName?: string;
      isActive?: boolean;
    },
  ) {
    const account = await this.accountRepository.findOne({ where: { id } });
    if (!account) {
      return null;
    }

    Object.assign(account, {
      type: input.type ?? account.type,
      userId: input.userId !== undefined ? input.userId || null : account.userId,
      username:
        input.username !== undefined ? input.username || null : account.username,
      password:
        input.password !== undefined ? input.password || null : account.password,
      providerUserId:
        input.providerUserId !== undefined
          ? input.providerUserId || null
          : account.providerUserId,
      email: input.email !== undefined ? input.email || null : account.email,
      displayName:
        input.displayName !== undefined
          ? input.displayName || null
          : account.displayName,
      isActive: input.isActive ?? account.isActive,
    });

    return this.accountRepository.save(account);
  }

  async deleteAccount(id: number) {
    const result = await this.accountRepository.delete({ id });
    return result.affected && result.affected > 0;
  }

  async getDashboard() {
    const orders = await this.ordersService.getOrders();
    const products = await this.productsService.getAdminProducts();

    const totalSales = orders
      .filter((order) => order.status !== '취소')
      .reduce((sum, order) => sum + order.totalAmount, 0);

    const pendingTransfers = orders.filter(
      (order) => order.status === '접수',
    ).length;

    const preparing = orders.filter(
      (order) => order.status === '준비중',
    ).length;

    return {
      totalProducts: products.filter((product) => product.active).length,
      totalOrders: orders.length,
      totalSales,
      pendingTransfers,
      preparing,
    };
  }

  getAdminOrders() {
    return this.ordersService.getOrders();
  }

  async updateOrderStatus(id: string, status: OrderStatus) {
    return this.ordersService.updateOrderStatus(id, status);
  }

  getAdminProducts() {
    return this.productsService.getAdminProducts();
  }

  async createProduct(input: CreateProductInput) {
    return this.productsService.createProduct(input);
  }

  async updateProduct(id: string, input: UpdateProductInput) {
    return this.productsService.updateProduct(id, input);
  }

  getAdminInquiries() {
    return this.inquiriesService.getAdminInquiries();
  }

  getAdminReviews() {
    return this.reviewsService.getReviews();
  }

  getStoreConfig() {
    return this.configService.getStoreConfig();
  }

  updateStoreConfig(input: Partial<StoreConfig>) {
    return this.configService.updateStoreConfig(input);
  }
}
