import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { OrdersService } from '../services/orders.service';

type CreateOrderBody = {
  customerName?: string;
  phone?: string;
  recipientPhone?: string;
  shippingAddress?: string;
  requestNote?: string;
  depositorName?: string;
  purchaseType?: 'member' | 'guest';
  excludeMemberBonus?: boolean;
  lookupToken?: string;
  // 회원 전용: 주문자 계정 및 쿠폰/적립금
  accountId?: number | null;
  couponId?: number | null;
  mileageToUse?: number;
  items?: Array<{
    productId?: number;
    quantity?: number;
  }>;
};

type GuestLookupRequestBody = {
  phone?: string;
  purpose?: 'checkout' | 'lookup';
};

type GuestLookupVerifyBody = {
  phone?: string;
  code?: string;
};

type CancelOrderBody = {
  userId?: string;
  phone?: string;
  reason?: string;
  lookupToken?: string;
};

type UpdateOrderStatusBody = {
  status?: import('../../../shared/store.types').OrderStatus;
};

type BackofficeCreateOrderBody = {
  customerName?: string;
  phone?: string;
  recipientPhone?: string;
  shippingAddress?: string;
  requestNote?: string;
  depositorName?: string;
  purchaseType?: 'member' | 'guest';
  accountId?: number | null;
  items?: Array<{
    productId?: number;
    quantity?: number;
  }>;
};

type BackofficeUpdateOrderBody = {
  customerName?: string;
  phone?: string;
  recipientPhone?: string;
  shippingAddress?: string;
  requestNote?: string;
  depositorName?: string;
  cancelReason?: string | null;
};

@Controller('api')
export class OrdersController {
  private readonly logger = new Logger(OrdersController.name);

  constructor(private readonly ordersService: OrdersService) {}

  @Post('orders')
  createOrder(@Body() body: CreateOrderBody) {
    const customerName = body.customerName?.trim();
    const phone = body.phone?.trim();
    const recipientPhone = body.recipientPhone?.trim();
    const shippingAddress = body.shippingAddress?.trim();
    const requestNote = body.requestNote?.trim();
    const depositorName = body.depositorName?.trim();
    const purchaseType = body.purchaseType;
    const lookupToken = body.lookupToken?.trim();
    const items = body.items ?? [];

    if (!phone || !recipientPhone || !depositorName) {
      throw new BadRequestException('주문자, 주문자 연락처, 받는분 연락처를 입력해주세요.');
    }

    if (!items.length) {
      throw new BadRequestException('최소 1개 이상의 상품을 주문해야 합니다.');
    }

    const normalizedItems = items.map((item) => {
      if (typeof item.productId !== 'number' || Number.isNaN(item.productId)) {
        throw new BadRequestException('상품 id가 올바르지 않습니다.');
      }

      return {
        productId: item.productId,
        quantity: item.quantity ?? 0,
      };
    });

    return this.ordersService.createOrder({
      customerName: customerName || depositorName,
      phone,
      recipientPhone,
      shippingAddress: shippingAddress || '배송지 미입력',
      requestNote,
      depositorName,
      purchaseType,
      excludeMemberBonus: purchaseType === 'member' ? body.excludeMemberBonus === true : false,
      lookupToken,
      // 회원 전용: 주문자 계정 및 쿠폰/적립금 (비회원은 무시됨)
      accountId:
        purchaseType === 'member' && typeof body.accountId === 'number'
          ? body.accountId
          : null,
      couponId:
        purchaseType === 'member' && typeof body.couponId === 'number'
          ? body.couponId
          : null,
      mileageToUse:
        purchaseType === 'member' ? Math.max(0, Math.floor(Number(body.mileageToUse) || 0)) : 0,
      items: normalizedItems,
    });
  }

  @Get('orders')
  getOrders(
    @Query('userId') userIdRaw?: string,
  ) {
    const userId =
      typeof userIdRaw === 'string' && userIdRaw.trim()
        ? userIdRaw.trim().toLowerCase()
        : undefined;

    if (!userId) {
      throw new BadRequestException('userId가 필요합니다.');
    }

    this.logger.log('[orders] getOrders request', {
      userId,
    });

    return this.ordersService.getOrdersByUserId(userId);
  }

  @Post('orders/lookup/request')
  requestGuestLookup(@Body() body: GuestLookupRequestBody) {
    const phone = body.phone?.trim();
    const purpose = body.purpose === 'checkout' ? 'checkout' : 'lookup';

    if (!phone) {
      throw new BadRequestException('전화번호를 입력해주세요.');
    }

    return this.ordersService.requestGuestOrderLookup(phone, purpose);
  }

  @Post('orders/lookup/verify')
  verifyGuestLookup(@Body() body: GuestLookupVerifyBody) {
    const phone = body.phone?.trim();
    const code = body.code?.trim();

    if (!phone || !code) {
      throw new BadRequestException('전화번호와 인증번호를 모두 입력해주세요.');
    }

    return this.ordersService.verifyGuestOrderLookup(phone, code);
  }

  @Get('orders/guest')
  getGuestOrders(
    @Query('phone') phone?: string,
    @Query('lookupToken') lookupToken?: string,
  ) {
    const normalizedPhone = phone?.trim();
    const normalizedLookupToken = lookupToken?.trim();

    if (!normalizedPhone || !normalizedLookupToken) {
      throw new BadRequestException('휴대폰 인증 정보가 필요합니다.');
    }

    return this.ordersService.getOrdersByVerifiedPhone(
      normalizedPhone,
      normalizedLookupToken,
    );
  }

  @Get('orders/:id')
  getOrderById(@Param('id') id: string) {
    return this.ordersService.getOrderById(this.parseOrderId(id));
  }

  @Patch('orders/:id/cancel')
  cancelOrder(
    @Param('id') id: string,
    @Body() body: CancelOrderBody,
  ) {
    const userId = body.userId?.trim().toLowerCase();
    const phone = body.phone?.trim();
    const reason = body.reason?.trim();
    const lookupToken = body.lookupToken?.trim();

    if (!reason) {
      throw new BadRequestException('주문 취소 사유를 입력해주세요.');
    }

    if (!userId && !phone) {
      throw new BadRequestException('userId 또는 전화번호가 필요합니다.');
    }

    return this.ordersService.cancelOrderByCustomer({
      id: this.parseOrderId(id),
      userId,
      phone,
      reason,
      lookupToken,
    });
  }

  // Backoffice endpoints
  @Get('backoffice/orders')
  getBackofficeOrders() {
    return this.ordersService.getOrders();
  }

  @Post('backoffice/orders')
  async createBackofficeOrder(@Body() body: BackofficeCreateOrderBody) {
    const customerName = body.customerName?.trim();
    const phone = body.phone?.trim();
    const recipientPhone = body.recipientPhone?.trim();
    const shippingAddress = body.shippingAddress?.trim();
    const requestNote = body.requestNote?.trim();
    const depositorName = body.depositorName?.trim();
    const items = body.items ?? [];

    if (!customerName || !phone || !recipientPhone || !shippingAddress || !depositorName) {
      throw new BadRequestException('받는분, 주문자 연락처, 받는분 연락처, 배송지, 주문자를 입력해주세요.');
    }

    if (!items.length) {
      throw new BadRequestException('최소 1개 이상의 상품을 선택해주세요.');
    }

    const normalizedItems = items.map((item) => {
      if (typeof item.productId !== 'number' || Number.isNaN(item.productId)) {
        throw new BadRequestException('상품 id가 올바르지 않습니다.');
      }

      return {
        productId: item.productId,
        quantity: item.quantity ?? 0,
      };
    });

    return this.ordersService.createBackofficeOrder({
      customerName,
      phone,
      recipientPhone,
      shippingAddress,
      requestNote,
      depositorName,
      purchaseType: body.purchaseType === 'guest' ? 'guest' : 'member',
      accountId: typeof body.accountId === 'number' ? body.accountId : null,
      items: normalizedItems,
    });
  }

  @Patch('backoffice/orders/:id')
  async updateBackofficeOrder(
    @Param('id') id: string,
    @Body() body: BackofficeUpdateOrderBody,
  ) {
    return this.ordersService.updateBackofficeOrder(this.parseOrderId(id), {
      customerName: body.customerName,
      phone: body.phone,
      recipientPhone: body.recipientPhone,
      shippingAddress: body.shippingAddress,
      requestNote: body.requestNote,
      depositorName: body.depositorName,
      cancelReason: body.cancelReason,
    });
  }

  @Patch('backoffice/orders/:id/status')
  async updateOrderStatus(
    @Param('id') id: string,
    @Body() body: UpdateOrderStatusBody,
  ) {
    if (!body.status) {
      throw new BadRequestException('주문 상태가 필요합니다.');
    }

    return this.ordersService.updateOrderStatus(this.parseOrderId(id), body.status);
  }

  @Delete('backoffice/orders/:id')
  async deleteBackofficeOrder(@Param('id') id: string) {
    return this.ordersService.deleteBackofficeOrder(this.parseOrderId(id));
  }

  private parseOrderId(id: string): number {
    const orderId = Number(id);
    if (!Number.isInteger(orderId) || orderId <= 0) {
      throw new BadRequestException('주문번호가 올바르지 않습니다.');
    }
    return orderId;
  }
}
