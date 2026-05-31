import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { OrdersService } from './orders.service';

type CreateOrderBody = {
  customerName?: string;
  phone?: string;
  shippingAddress?: string;
  depositorName?: string;
  items?: Array<{
    productId?: string;
    quantity?: number;
  }>;
};

@Controller('api')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post('orders')
  createOrder(@Body() body: CreateOrderBody) {
    const customerName = body.customerName?.trim();
    const phone = body.phone?.trim();
    const shippingAddress = body.shippingAddress?.trim();
    const depositorName = body.depositorName?.trim();
    const items = body.items ?? [];

    if (!phone || !depositorName) {
      throw new BadRequestException('입금자명과 연락처를 입력해주세요.');
    }

    if (!items.length) {
      throw new BadRequestException('최소 1개 이상의 상품을 주문해야 합니다.');
    }

    return this.ordersService.createOrder({
      customerName: customerName || depositorName,
      phone,
      shippingAddress: shippingAddress || '배송지 미입력',
      depositorName,
      items: items.map((item) => ({
        productId: item.productId ?? '',
        quantity: item.quantity ?? 0,
      })),
    });
  }

  @Get('orders')
  getOrders(@Query('phone') phone?: string) {
    return this.ordersService.getOrders(phone);
  }

  @Get('orders/:id')
  getOrderById(@Param('id') id: string) {
    return this.ordersService.getOrderById(id);
  }
}
