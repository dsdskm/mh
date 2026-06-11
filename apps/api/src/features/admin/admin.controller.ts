import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { OrderStatus, StoreConfig } from '../../shared/store.types';
import type {
  AdminUserCreateInput,
  AdminUserUpdateInput,
  UserStatus,
  UserType,
} from '@repo/shared-types/user';

type CreateProductBody = {
  name?: string;
  description?: string;
  price?: number;
  stock?: number;
  totalQuantity?: number;
  imageUrl?: string;
  badge?: string;
  active?: boolean;
};

type UpdateOrderStatusBody = {
  status?: OrderStatus;
};

type LoginBody = {
  id?: string;
  userId?: string;
  password?: string;
};

type AccountBody = AdminUserCreateInput & AdminUserUpdateInput;

@Controller('api/admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Post('login')
  async login(@Body() body: LoginBody) {
    const userId = (body.userId ?? body.id)?.trim();
    const password = body.password?.trim();

    if (!userId || !password) {
      throw new BadRequestException('userId, password를 입력해주세요.');
    }

    const ok = await this.adminService.login(userId, password);
    if (!ok) {
      throw new UnauthorizedException('아이디 또는 비밀번호가 올바르지 않습니다.');
    }

    return { ok: true };
  }

  @Get('accounts')
  getAccounts() {
    return this.adminService.getAccounts();
  }

  @Post('accounts')
  createAccount(@Body() body: AccountBody) {
    const type = this.parseAccountType(body.type);
    const status = this.parseAccountStatus(body.status);

    if (type === 'NORMAL' && (!body.userId?.trim() || !body.password?.trim())) {
      throw new BadRequestException(
        'NORMAL 계정은 userId, password가 필요합니다.',
      );
    }

    if (
      (type === 'KAKAO' || type === 'NAVER') &&
      !body.providerUserId?.trim()
    ) {
      throw new BadRequestException(
        `${type} 계정은 providerUserId가 필요합니다.`,
      );
    }

    return this.adminService.createAccount({
      type,
      userId: body.userId?.trim(),
      username: body.username?.trim(),
      password: body.password?.trim(),
      providerUserId: body.providerUserId?.trim(),
      displayName: body.displayName?.trim(),
      phone: body.phone?.trim(),
      address1: body.address1?.trim(),
      address2: body.address2?.trim(),
      status,
      statusReason: body.statusReason?.trim(),
      isActive: body.isActive,
    });
  }

  @Patch('accounts/:id')
  async updateAccount(
    @Param('id') id: string,
    @Body() body: AccountBody,
  ) {
    const parsedId = Number(id);
    if (Number.isNaN(parsedId)) {
      throw new BadRequestException('계정 id가 올바르지 않습니다.');
    }

    const type = body.type ? this.parseAccountType(body.type) : undefined;
    const status = body.status ? this.parseAccountStatus(body.status) : undefined;

    const updated = await this.adminService.updateAccount(parsedId, {
      type,
      userId: body.userId?.trim(),
      username: body.username?.trim(),
      password: body.password?.trim(),
      providerUserId: body.providerUserId?.trim(),
      displayName: body.displayName?.trim(),
      phone: body.phone?.trim(),
      address1: body.address1?.trim(),
      address2: body.address2?.trim(),
      status,
      statusReason: body.statusReason?.trim(),
      isActive: body.isActive,
    });

    if (!updated) {
      throw new NotFoundException('계정을 찾을 수 없습니다.');
    }

    return updated;
  }

  @Get('accounts/:id/shipping-addresses')
  async getAccountShippingAddresses(@Param('id') id: string) {
    const parsedId = Number(id);
    if (Number.isNaN(parsedId)) {
      throw new BadRequestException('계정 id가 올바르지 않습니다.');
    }
    return this.adminService.getAccountShippingAddresses(parsedId);
  }

  @Delete('accounts/:id')
  async deleteAccount(@Param('id') id: string) {
    const parsedId = Number(id);
    if (Number.isNaN(parsedId)) {
      throw new BadRequestException('계정 id가 올바르지 않습니다.');
    }

    const deleted = await this.adminService.deleteAccount(parsedId);
    if (!deleted) {
      throw new NotFoundException('계정을 찾을 수 없습니다.');
    }

    return { ok: true };
  }

  @Get('dashboard')
  async getDashboard() {
    return this.adminService.getDashboard();
  }

  @Get('orders')
  async getAdminOrders() {
    return this.adminService.getAdminOrders();
  }

  @Patch('orders/:id/status')
  async updateOrderStatus(
    @Param('id') id: string,
    @Body() body: UpdateOrderStatusBody,
  ) {
    if (!body.status) {
      throw new BadRequestException('주문 상태가 필요합니다.');
    }

    return this.adminService.updateOrderStatus(id, body.status);
  }

  @Get('products')
  async getAdminProducts() {
    return this.adminService.getAdminProducts();
  }

  @Post('products')
  async createProduct(
    @Body() body: CreateProductBody,
  ) {
    if (
      !body.name ||
      !body.description ||
      !body.imageUrl ||
      !body.badge ||
      typeof body.price !== 'number' ||
      typeof body.stock !== 'number' ||
      typeof body.totalQuantity !== 'number'
    ) {
      throw new BadRequestException('상품 필수값을 확인해주세요.');
    }

    if (body.stock > body.totalQuantity) {
      throw new BadRequestException('재고는 총 수량을 초과할 수 없습니다.');
    }

    return this.adminService.createProduct({
      name: body.name,
      description: body.description,
      price: body.price,
      stock: body.stock,
      totalQuantity: body.totalQuantity,
      imageUrl: body.imageUrl,
      badge: body.badge,
      active: body.active,
    });
  }

  @Patch('products/:id')
  async updateProduct(
    @Param('id') id: string,
    @Body() body: CreateProductBody,
  ) {
    const parsedId = Number(id);
    if (Number.isNaN(parsedId)) {
      throw new BadRequestException('상품 id가 올바르지 않습니다.');
    }

    if (
      typeof body.stock === 'number' &&
      typeof body.totalQuantity === 'number' &&
      body.stock > body.totalQuantity
    ) {
      throw new BadRequestException('재고는 총 수량을 초과할 수 없습니다.');
    }

    return this.adminService.updateProduct(parsedId, body);
  }

  @Delete('products/:id')
  async deleteProduct(@Param('id') id: string) {
    const parsedId = Number(id);
    if (Number.isNaN(parsedId)) {
      throw new BadRequestException('상품 id가 올바르지 않습니다.');
    }

    const deleted = await this.adminService.deleteProduct(parsedId);
    if (!deleted) {
      throw new NotFoundException('상품을 찾을 수 없습니다.');
    }

    return { ok: true };
  }

  @Get('inquiries')
  async getAdminInquiries() {
    return this.adminService.getAdminInquiries();
  }

  @Get('reviews')
  async getAdminReviews() {
    return this.adminService.getAdminReviews();
  }

  @Get('config')
  async getAdminConfig() {
    return this.adminService.getStoreConfig();
  }

  @Patch('config')
  async updateAdminConfig(
    @Body() body: Partial<StoreConfig>,
  ) {
    return this.adminService.updateStoreConfig(body);
  }

  private parseAccountType(type?: string): UserType {
    const normalized = type?.trim().toUpperCase();
    if (
      normalized !== 'NORMAL' &&
      normalized !== 'KAKAO' &&
      normalized !== 'NAVER' &&
      normalized !== 'MASTER'
    ) {
      throw new BadRequestException('type은 NORMAL, KAKAO, NAVER, MASTER 중 하나여야 합니다.');
    }

    return normalized;
  }

  private parseAccountStatus(status?: string): UserStatus | undefined {
    if (!status) {
      return undefined;
    }

    const normalized = status.trim().toLowerCase();
    if (
      normalized !== 'active' &&
      normalized !== 'deactive' &&
      normalized !== 'withdraw'
    ) {
      throw new BadRequestException('status는 active, deactive, withdraw 중 하나여야 합니다.');
    }

    return normalized;
  }
}
