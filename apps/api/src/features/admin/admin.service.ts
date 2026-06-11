import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccountEntity } from '../../database/entities/account.entity';
import { AccountShippingAddressEntity } from '../../database/entities/account-shipping-address.entity';
import { NotFoundException } from '@nestjs/common';
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
import { ORDER_STATUS } from '@repo/shared-types/order';
import type {
  AdminUserCreateInput,
  AdminUserUpdateInput,
  SharedUser,
} from '@repo/shared-types/user';

@Injectable()
export class AdminService implements OnModuleInit {
  constructor(
    @InjectRepository(AccountEntity)
    private readonly accountRepository: Repository<AccountEntity>,
    @InjectRepository(AccountShippingAddressEntity)
    private readonly shippingAddressRepository: Repository<AccountShippingAddressEntity>,
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

  async getAccounts(): Promise<SharedUser[]> {
    const accounts = await this.accountRepository.find({
      order: { createdAt: 'DESC' },
    });

    return accounts.map((item) => this.toSharedUser(item));
  }

  async createAccount(input: AdminUserCreateInput): Promise<SharedUser> {
    const account = this.accountRepository.create({
      type: input.type,
      userId: input.userId ?? null,
      username: input.username ?? input.userId ?? null,
      password: input.password ?? null,
      providerUserId: input.providerUserId ?? null,
      email: null,
      displayName: input.displayName ?? null,
      phone: input.phone ?? null,
      address1: input.address1 ?? null,
      address2: input.address2 ?? null,
      status: input.status ?? 'active',
      statusReason: input.statusReason ?? null,
      isActive: input.isActive ?? true,
      termsAgreed: true,
      termsAgreedAt: new Date(),
    });

    const saved = await this.accountRepository.save(account);

    if (saved.address1) {
      await this.shippingAddressRepository.save(
        this.shippingAddressRepository.create({
          accountId: saved.id,
          name: '기본 배송지',
          address1: saved.address1,
          address2: saved.address2 ?? '',
          isDefault: true,
        }),
      );
    }

    return this.toSharedUser(saved);
  }

  async updateAccount(
    id: number,
    input: AdminUserUpdateInput,
  ): Promise<SharedUser | null> {
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
      displayName:
        input.displayName !== undefined
          ? input.displayName || null
          : account.displayName,
      phone: input.phone !== undefined ? input.phone || null : account.phone,
      address1:
        input.address1 !== undefined ? input.address1 || null : account.address1,
      address2:
        input.address2 !== undefined ? input.address2 || null : account.address2,
      status: input.status ?? account.status,
      statusReason:
        input.statusReason !== undefined
          ? input.statusReason || null
          : account.statusReason,
      isActive: input.isActive ?? account.isActive,
    });

    const saved = await this.accountRepository.save(account);
    return this.toSharedUser(saved);
  }

  async deleteAccount(id: number) {
    const result = await this.accountRepository.delete({ id });
    return result.affected && result.affected > 0;
  }

  async getAccountShippingAddresses(accountId: number) {
    const account = await this.accountRepository.findOne({ where: { id: accountId } });
    if (!account) {
      throw new NotFoundException('계정을 찾을 수 없습니다.');
    }

    const addresses = await this.shippingAddressRepository.find({
      where: { accountId },
      order: { isDefault: 'DESC', updatedAt: 'DESC' },
    });

    return {
      shippingAddresses: addresses.map((item) => ({
        id: item.id,
        name: item.name,
        address1: item.address1 ?? '',
        address2: item.address2 ?? '',
        isDefault: item.isDefault,
      })),
    };
  }

  private toSharedUser(account: AccountEntity): SharedUser {
    return {
      id: account.id,
      userId: account.userId,
      type: account.type,
      username: account.username,
      providerUserId: account.providerUserId,
      displayName: account.displayName,
      phone: account.phone,
      address1: account.address1,
      address2: account.address2,
      status: account.status,
      statusReason: account.statusReason,
      isActive: account.isActive,
      termsAgreed: account.termsAgreed,
      createdAt: account.createdAt.toISOString(),
      updatedAt: account.updatedAt.toISOString(),
    };
  }

  async getDashboard() {
    const orders = await this.ordersService.getOrders();
    const products = await this.productsService.getAdminProducts();

    const totalSales = orders
      .filter((order) => order.status !== ORDER_STATUS.CANCELLED)
      .reduce((sum, order) => sum + order.totalAmount, 0);

    const receivedOrders = orders.filter(
      (order) => order.status === ORDER_STATUS.RECEIVED,
    ).length;

    const paidOrders = orders.filter(
      (order) => order.status === ORDER_STATUS.PAID,
    ).length;

    const preparingOrders = orders.filter(
      (order) => order.status === ORDER_STATUS.PREPARING,
    ).length;

    return {
      totalProducts: products.filter((product) => product.active).length,
      totalOrders: orders.length,
      totalSales,
      receivedOrders,
      paidOrders,
      preparingOrders,
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

  async updateProduct(id: number, input: UpdateProductInput) {
    return this.productsService.updateProduct(id, input);
  }

  async deleteProduct(id: number) {
    return this.productsService.deleteProduct(id);
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
