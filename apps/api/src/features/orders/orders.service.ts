import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '../config/config.service';
import { DataSource, In, Like, QueryFailedError, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { OrderEntity } from '../../database/entities/order.entity';
import { OrderItemEntity } from '../../database/entities/order-item.entity';
import { ProductEntity } from '../../database/entities/product.entity';
import { CreateOrderInput, Order, OrderStatus } from '../../shared/store.types';

@Injectable()
export class OrdersService {
  private static readonly ORDER_ID_RETRY_LIMIT = 3;

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(OrderEntity)
    private readonly orderRepository: Repository<OrderEntity>,
    private readonly configService: ConfigService,
  ) {}

  async createOrder(input: CreateOrderInput) {
    for (let attempt = 0; attempt < OrdersService.ORDER_ID_RETRY_LIMIT; attempt += 1) {
      try {
        const order = await this.dataSource.transaction(async (manager) => {
          const productRepository = manager.getRepository(ProductEntity);
          const orderRepository = manager.getRepository(OrderEntity);
          const orderItemRepository = manager.getRepository(OrderItemEntity);

          const productIds = [...new Set(input.items.map((item) => item.productId))];
          const products = await productRepository.find({
            where: {
              id: In(productIds),
              active: true,
            },
          });

          const productMap = new Map(products.map((product) => [product.id, product]));

          if (productMap.size !== productIds.length) {
            const missingId = productIds.find((id) => !productMap.has(id));
            throw new NotFoundException(
              `상품(${missingId ?? 'unknown'})을 찾을 수 없습니다.`,
            );
          }

          const normalizedItems = input.items.map((line) => {
            const product = productMap.get(line.productId);

            if (!product) {
              throw new NotFoundException(`상품(${line.productId})을 찾을 수 없습니다.`);
            }

            if (line.quantity < 1) {
              throw new BadRequestException('주문 수량은 1개 이상이어야 합니다.');
            }

            if (product.stock < line.quantity) {
              throw new BadRequestException(`${product.name} 재고가 부족합니다.`);
            }

            return {
              productId: product.id,
              productName: product.name,
              unitPrice: product.price,
              quantity: line.quantity,
              subtotal: product.price * line.quantity,
            };
          });

          const totalAmount = normalizedItems.reduce(
            (sum, item) => sum + item.subtotal,
            0,
          );

          const created = await orderRepository.save(
            orderRepository.create({
              id: await this.createOrderId(orderRepository),
              customerName: input.customerName,
              phone: input.phone,
              shippingAddress: input.shippingAddress,
              depositorName: input.depositorName,
              status: '접수',
              totalAmount,
            }),
          );

          await orderItemRepository.save(
            normalizedItems.map((item) =>
              orderItemRepository.create({
                ...item,
                orderId: created.id,
              }),
            ),
          );

          for (const item of normalizedItems) {
            const result = await productRepository
              .createQueryBuilder()
              .update(ProductEntity)
              .set({ stock: () => `stock - ${item.quantity}` })
              .where('id = :id', { id: item.productId })
              .andWhere('active = :active', { active: true })
              .andWhere('stock >= :quantity', { quantity: item.quantity })
              .execute();

            if ((result.affected ?? 0) !== 1) {
              throw new BadRequestException(`${item.productName} 재고가 부족합니다.`);
            }
          }

          const loaded = await orderRepository.findOne({
            where: { id: created.id },
            relations: { items: true },
          });

          if (!loaded) {
            throw new NotFoundException('주문을 저장할 수 없습니다.');
          }

          return loaded;
        });

        return {
          order: this.toOrder(order),
          transfer: await this.configService.getStoreConfig(),
        };
      } catch (error) {
        const canRetry =
          attempt < OrdersService.ORDER_ID_RETRY_LIMIT - 1 &&
          this.isDuplicateOrderIdError(error);

        if (!canRetry) {
          throw error;
        }
      }
    }

    throw new BadRequestException('주문번호 생성에 실패했습니다. 다시 시도해주세요.');
  }

  async getOrders(phone?: string): Promise<Order[]> {
    const orders = phone
      ? await this.orderRepository.find({
          where: { phone: Like(`%${phone}%`) },
          relations: { items: true },
          order: { createdAt: 'DESC' },
        })
      : await this.orderRepository.find({
          relations: { items: true },
          order: { createdAt: 'DESC' },
        });

    return orders.map((order) => this.toOrder(order));
  }

  async getOrderById(id: string): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { id },
      relations: { items: true },
    });

    if (!order) {
      throw new NotFoundException('주문을 찾을 수 없습니다.');
    }

    return this.toOrder(order);
  }

  async updateOrderStatus(id: string, status: OrderStatus): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { id },
      relations: { items: true },
    });
    if (!order) {
      throw new NotFoundException('주문을 찾을 수 없습니다.');
    }

    const updated = await this.orderRepository.save({
      ...order,
      status,
    });

    return this.toOrder(updated);
  }

  private async createOrderId(orderRepository: Repository<OrderEntity>): Promise<string> {
    const datePrefix = this.getKstDatePrefix();
    const latestOrder = await orderRepository
      .createQueryBuilder('order')
      .select('order.id', 'id')
      .where('order.id LIKE :prefix', { prefix: `${datePrefix}%` })
      .orderBy('order.id', 'DESC')
      .limit(1)
      .getRawOne<{ id: string }>();

    const nextSequence = latestOrder?.id
      ? Number(latestOrder.id.slice(datePrefix.length)) + 1
      : 1;

    if (!Number.isFinite(nextSequence) || nextSequence < 1) {
      throw new BadRequestException('주문번호 시퀀스를 계산할 수 없습니다.');
    }

    return `${datePrefix}${String(nextSequence).padStart(5, '0')}`;
  }

  private getKstDatePrefix(): string {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());

    const year = parts.find((part) => part.type === 'year')?.value ?? '';
    const month = parts.find((part) => part.type === 'month')?.value ?? '';
    const day = parts.find((part) => part.type === 'day')?.value ?? '';

    return `${year}${month}${day}`;
  }

  private isDuplicateOrderIdError(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) {
      return false;
    }

    const code =
      typeof error.driverError === 'object' && error.driverError !== null
        ? String((error.driverError as { code?: unknown }).code ?? '')
        : '';
    const message =
      typeof error.driverError === 'object' && error.driverError !== null
        ? String((error.driverError as { detail?: unknown; message?: unknown }).detail ?? (error.driverError as { message?: unknown }).message ?? '')
        : '';

    return code === '23505' || message.includes('orders_pkey');
  }

  private toOrder(order: OrderEntity): Order {
    return {
      id: order.id,
      customerName: order.customerName,
      phone: order.phone,
      shippingAddress: order.shippingAddress,
      depositorName: order.depositorName,
      status: order.status as OrderStatus,
      totalAmount: order.totalAmount,
      createdAt: order.createdAt.toISOString(),
      items: (order.items ?? []).map((item) => ({
        productId: item.productId,
        name: item.productName,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        subtotal: item.subtotal,
      })),
    };
  }
}
