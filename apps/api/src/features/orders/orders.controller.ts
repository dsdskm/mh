import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { OrdersService } from './orders.service';

type CreateOrderBody = {
  customerName?: string;
  phone?: string;
  shippingAddress?: string;
  requestNote?: string;
  depositorName?: string;
  purchaseType?: 'member' | 'guest';
  lookupToken?: string;
  items?: Array<{
    productId?: number;
    quantity?: number;
  }>;
};

type GuestLookupRequestBody = {
  phone?: string;
};

type GuestLookupVerifyBody = {
  phone?: string;
  code?: string;
};

type CancelOrderBody = {
  phone?: string;
  reason?: string;
  lookupToken?: string;
};

@Controller('api')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post('orders')
  createOrder(@Body() body: CreateOrderBody) {
    const customerName = body.customerName?.trim();
    const phone = body.phone?.trim();
    const shippingAddress = body.shippingAddress?.trim();
    const requestNote = body.requestNote?.trim();
    const depositorName = body.depositorName?.trim();
    const purchaseType = body.purchaseType;
    const lookupToken = body.lookupToken?.trim();
    const items = body.items ?? [];

    if (!phone || !depositorName) {
      throw new BadRequestException('입금자명과 연락처를 입력해주세요.');
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
      shippingAddress: shippingAddress || '배송지 미입력',
      requestNote,
      depositorName,
      purchaseType,
      lookupToken,
      items: normalizedItems,
    });
  }

  @Get('orders')
  getOrders(@Query('phone') phone?: string) {
    return this.ordersService.getOrders(phone);
  }

  @Post('orders/lookup/request')
  requestGuestLookup(@Body() body: GuestLookupRequestBody) {
    const phone = body.phone?.trim();

    if (!phone) {
      throw new BadRequestException('전화번호를 입력해주세요.');
    }

    return this.ordersService.requestGuestOrderLookup(phone);
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
    return this.ordersService.getOrderById(id);
  }

  @Patch('orders/:id/cancel')
  cancelOrder(
    @Param('id') id: string,
    @Body() body: CancelOrderBody,
  ) {
    const phone = body.phone?.trim();
    const reason = body.reason?.trim();
    const lookupToken = body.lookupToken?.trim();

    if (!phone) {
      throw new BadRequestException('전화번호를 입력해주세요.');
    }

    if (!reason) {
      throw new BadRequestException('주문 취소 사유를 입력해주세요.');
    }

    return this.ordersService.cancelOrderByCustomer({
      id,
      phone,
      reason,
      lookupToken,
    });
  }
}
