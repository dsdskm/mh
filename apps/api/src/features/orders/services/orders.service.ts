import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '../../config/services/config.service';
import { DataSource, In, Like, QueryFailedError, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { OrderEntity } from '../../../database/entities/order.entity';
import { OrderItemEntity } from '../../../database/entities/order-item.entity';
import { ProductEntity } from '../../../database/entities/product.entity';
import { AccountEntity } from '../../../database/entities/account.entity';
import { CreateOrderInput, Order, OrderStatus } from '../../../shared/store.types';
import { ORDER_STATUS } from '@repo/shared-types/order';
import { randomBytes, randomInt } from 'node:crypto';
import { FirestoreTriggerService } from '../../../shared/firestore-trigger.service';
import { NotificationsService } from '../../notifications/services/notifications.service';

type PhoneCodeState = {
  code: string;
  expiresAt: number;
  attempts: number;
};

type VerifiedLookupState = {
  phone: string;
  expiresAt: number;
};

@Injectable()
export class OrdersService {
  private static readonly ORDER_ID_RETRY_LIMIT = 3;
  private static readonly LOOKUP_CODE_EXPIRE_MS = 3 * 60 * 1000;
  private static readonly LOOKUP_TOKEN_EXPIRE_MS = 10 * 60 * 1000;
  private static readonly LOOKUP_MAX_VERIFY_ATTEMPTS = 5;
  private static readonly CUSTOMER_CANCELLABLE_STATUSES: OrderStatus[] = [
    ORDER_STATUS.RECEIVED,
    ORDER_STATUS.PREPARING,
  ];

  private readonly guestLookupCodeStore = new Map<string, PhoneCodeState>();
  private readonly guestLookupVerifiedStore = new Map<string, VerifiedLookupState>();

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(OrderEntity)
    private readonly orderRepository: Repository<OrderEntity>,
    @InjectRepository(AccountEntity)
    private readonly accountRepository: Repository<AccountEntity>,
    private readonly configService: ConfigService,
    private readonly firestoreTrigger: FirestoreTriggerService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async createOrder(input: CreateOrderInput) {
    if (input.purchaseType === 'guest') {
      const phone = this.normalizePhone(input.phone);
      this.assertPhoneFormat(phone);

      const lookupToken = input.lookupToken?.trim();
      if (!lookupToken) {
        throw new BadRequestException('비회원 주문은 휴대폰 문자 인증이 필요합니다.');
      }

      this.assertGuestLookupVerified(phone, lookupToken);
    }

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
              requestNote: input.requestNote?.trim() || null,
              depositorName: input.depositorName,
              purchaseType: input.purchaseType === 'member' ? 'member' : 'guest',
              status: ORDER_STATUS.RECEIVED,
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

        const result = {
          order: this.toOrder(order),
          transfer: await this.configService.getStoreConfig(),
        };
        await this.notificationsService.createNotification({
          title: '신규 주문이 접수되었습니다.',
          content: `${result.order.customerName} 님 주문 ${result.order.id}`,
          type: 'order',
          url: '/orders',
        });
        void this.firestoreTrigger.notify('orders');
        return result;
      } catch (error) {
        const canRetry =
          attempt < OrdersService.ORDER_ID_RETRY_LIMIT - 1 &&
          this.isDuplicateOrderIdError(error);

        if (!canRetry) {
          throw error;
        }
      }
    }

    // shouldn't reach here
    throw new BadRequestException('주문번호 생성에 실패했습니다. 다시 시도해주세요.');
  }

  async createBackofficeOrder(input: Omit<CreateOrderInput, 'purchaseType' | 'lookupToken'>): Promise<Order> {
    const result = await this.createOrder({
      ...input,
      // 관리자 직접 등록은 인증 없이 처리합니다.
      purchaseType: 'member',
    });

    return result.order;
  }

  async updateBackofficeOrder(
    id: string,
    input: {
      customerName?: string;
      phone?: string;
      shippingAddress?: string;
      requestNote?: string;
      depositorName?: string;
      cancelReason?: string | null;
    },
  ): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { id },
      relations: { items: true },
    });

    if (!order) {
      throw new NotFoundException('주문을 찾을 수 없습니다.');
    }

    const nextPhone = input.phone?.trim() ?? order.phone;
    this.assertPhoneFormat(this.normalizePhone(nextPhone));

    const updated = await this.orderRepository.save({
      ...order,
      customerName: input.customerName?.trim() || order.customerName,
      phone: nextPhone,
      shippingAddress: input.shippingAddress?.trim() || order.shippingAddress,
      requestNote: input.requestNote?.trim() || null,
      depositorName: input.depositorName?.trim() || order.depositorName,
      cancelReason: input.cancelReason === null ? null : input.cancelReason?.trim() || order.cancelReason,
    });

    return this.toOrder(updated);
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
    const updated = await this.dataSource.transaction(async (manager) => {
      const orderRepository = manager.getRepository(OrderEntity);
      const productRepository = manager.getRepository(ProductEntity);

      const order = await orderRepository.findOne({
        where: { id },
        relations: { items: true },
      });
      if (!order) {
        throw new NotFoundException('주문을 찾을 수 없습니다.');
      }

      const currentStatus = this.normalizeOrderStatus(order.status);

      if (currentStatus === ORDER_STATUS.CANCEL_COMPLETED && status !== ORDER_STATUS.CANCEL_COMPLETED) {
        throw new BadRequestException('취소 완료된 주문은 상태를 변경할 수 없습니다.');
      }

      if (status === ORDER_STATUS.CANCEL_COMPLETED && currentStatus !== ORDER_STATUS.CANCEL_COMPLETED) {
        for (const item of order.items ?? []) {
          await productRepository
            .createQueryBuilder()
            .update(ProductEntity)
            .set({ stock: () => `stock + ${item.quantity}` })
            .where('id = :id', { id: item.productId })
            .execute();
        }
      }

      return orderRepository.save({
        ...order,
        status,
        cancelReason: (status === ORDER_STATUS.CANCEL_REQUESTED || status === ORDER_STATUS.CANCEL_COMPLETED) ? order.cancelReason : null,
      });
    });

    await this.notificationsService.createNotification({
      title: '주문 취소 요청이 접수되었습니다.',
      content: `${updated.customerName} 님 주문 ${updated.id}`,
      type: 'order',
      url: '/orders',
    });

    void this.firestoreTrigger.notify('orders');
    return this.toOrder(updated);
  }

  async cancelOrderByCustomer(input: {
    id: string;
    phone: string;
    reason: string;
    lookupToken?: string;
  }): Promise<Order> {
    const normalizedPhone = this.normalizePhone(input.phone);
    this.assertPhoneFormat(normalizedPhone);

    if (input.lookupToken?.trim()) {
      this.assertGuestLookupVerified(normalizedPhone, input.lookupToken.trim());
    }

    const cancelReason = input.reason.trim();
    if (!cancelReason) {
      throw new BadRequestException('주문 취소 사유를 입력해주세요.');
    }

    const updated = await this.dataSource.transaction(async (manager) => {
      const orderRepository = manager.getRepository(OrderEntity);
      const productRepository = manager.getRepository(ProductEntity);

      const order = await orderRepository.findOne({
        where: { id: input.id },
        relations: { items: true },
      });

      if (!order) {
        throw new NotFoundException('주문을 찾을 수 없습니다.');
      }

      const currentStatus = this.normalizeOrderStatus(order.status);

      if (this.normalizePhone(order.phone) !== normalizedPhone) {
        throw new BadRequestException('주문자 연락처가 일치하지 않습니다.');
      }

      if (currentStatus === ORDER_STATUS.CANCEL_REQUESTED || currentStatus === ORDER_STATUS.CANCEL_COMPLETED) {
        throw new BadRequestException('이미 취소 요청된 주문입니다.');
      }

      if (!OrdersService.CUSTOMER_CANCELLABLE_STATUSES.includes(currentStatus)) {
        throw new BadRequestException('주문은 접수 또는 상품 준비중 상태에서만 취소할 수 있습니다.');
      }

      // 재고는 관리자가 취소 완료 처리할 때 복구됩니다.
      return orderRepository.save({
        ...order,
        status: ORDER_STATUS.CANCEL_REQUESTED,
        cancelReason,
      });
    });

    void this.firestoreTrigger.notify('orders');
    return this.toOrder(updated);
  }

  async requestGuestOrderLookup(phoneRaw: string) {
    const phone = this.normalizePhone(phoneRaw);
    this.assertPhoneFormat(phone);

    const existingAccount = await this.accountRepository.findOne({
      where: { phone },
    });

    if (existingAccount) {
      return {
        ok: false,
        alreadyRegistered: true,
        existingUserId: existingAccount.userId ?? existingAccount.username ?? null,
        message: '이미 가입된 번호입니다. 로그인 후 주문해주세요.',
      };
    }

    const code = this.createPhoneCode();
    const expiresAt = Date.now() + OrdersService.LOOKUP_CODE_EXPIRE_MS;

    this.guestLookupCodeStore.set(phone, {
      code,
      expiresAt,
      attempts: 0,
    });

    const isProduction = process.env.NODE_ENV === 'production';
    await this.sendPhoneCode(phone, code, isProduction);

    return {
      ok: true,
      expiresAt: new Date(expiresAt).toISOString(),
      devCode: isProduction ? undefined : code,
    };
  }

  async verifyGuestOrderLookup(phoneRaw: string, codeRaw: string) {
    const phone = this.normalizePhone(phoneRaw);
    const code = codeRaw.trim();
    this.assertPhoneFormat(phone);

    const state = this.guestLookupCodeStore.get(phone);
    if (!state) {
      throw new BadRequestException('인증요청을 먼저 진행해주세요.');
    }

    if (Date.now() > state.expiresAt) {
      this.guestLookupCodeStore.delete(phone);
      throw new BadRequestException('인증번호가 만료되었습니다. 다시 요청해주세요.');
    }

    if (state.attempts >= OrdersService.LOOKUP_MAX_VERIFY_ATTEMPTS) {
      this.guestLookupCodeStore.delete(phone);
      throw new BadRequestException('인증 시도 횟수를 초과했습니다. 다시 요청해주세요.');
    }

    if (state.code !== code) {
      state.attempts += 1;
      this.guestLookupCodeStore.set(phone, state);
      throw new BadRequestException('인증번호가 일치하지 않습니다.');
    }

    this.guestLookupCodeStore.delete(phone);

    const lookupToken = randomBytes(24).toString('hex');
    const tokenExpiresAt = Date.now() + OrdersService.LOOKUP_TOKEN_EXPIRE_MS;

    this.guestLookupVerifiedStore.set(lookupToken, {
      phone,
      expiresAt: tokenExpiresAt,
    });

    const orders = await this.getOrdersByVerifiedPhone(phone, lookupToken);

    return {
      ok: true,
      lookupToken,
      expiresAt: new Date(tokenExpiresAt).toISOString(),
      orders,
    };
  }

  async getOrdersByVerifiedPhone(phoneRaw: string, lookupToken: string): Promise<Order[]> {
    const phone = this.normalizePhone(phoneRaw);
    this.assertPhoneFormat(phone);

    this.assertGuestLookupVerified(phone, lookupToken.trim());

    return this.getOrders(phone);
  }

  private assertGuestLookupVerified(phone: string, lookupToken: string): void {
    const verified = this.guestLookupVerifiedStore.get(lookupToken);
    if (!verified || verified.phone !== phone) {
      throw new BadRequestException('휴대폰 인증이 필요합니다.');
    }

    if (Date.now() > verified.expiresAt) {
      this.guestLookupVerifiedStore.delete(lookupToken);
      throw new BadRequestException('인증이 만료되었습니다. 다시 인증해주세요.');
    }
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

  private normalizePhone(phone: string): string {
    return phone.replace(/\D/g, '');
  }

  private assertPhoneFormat(phone: string): void {
    if (!/^01\d{8,9}$/.test(phone)) {
      throw new BadRequestException('유효한 휴대폰 번호를 입력해주세요.');
    }
  }

  private createPhoneCode(): string {
    return String(randomInt(0, 1_000_000)).padStart(6, '0');
  }

  private async sendPhoneCode(
    phone: string,
    code: string,
    isProduction: boolean,
  ): Promise<void> {
    const webhookUrl = process.env.SMS_WEBHOOK_URL?.trim();
    const message = `[옥수수마켓] 주문조회 인증번호 ${code} 를 입력해주세요.`;

    if (!webhookUrl) {
      if (isProduction) {
        throw new BadRequestException('문자 발송 설정이 누락되었습니다. 관리자에게 문의해주세요.');
      }

      console.info(`[DEV_SMS_LOOKUP] to=${phone}, code=${code}`);
      return;
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: phone,
        message,
      }),
    });

    if (!response.ok) {
      throw new BadRequestException('문자 발송에 실패했습니다. 잠시 후 다시 시도해주세요.');
    }
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
    const status = this.normalizeOrderStatus(order.status);

    return {
      id: order.id,
      customerName: order.customerName,
      purchaseType: this.normalizePurchaseType(order.purchaseType),
      phone: order.phone,
      shippingAddress: order.shippingAddress,
      requestNote: order.requestNote,
      cancelReason: order.cancelReason,
      depositorName: order.depositorName,
      status,
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

  private normalizeOrderStatus(statusRaw: string): OrderStatus {
    if (statusRaw === ORDER_STATUS.RECEIVED || statusRaw === '접수') {
      return ORDER_STATUS.RECEIVED;
    }

    if (statusRaw === ORDER_STATUS.PAID || statusRaw === '입금 확인') {
      return ORDER_STATUS.PAID;
    }

    if (
      statusRaw === ORDER_STATUS.PREPARING ||
      statusRaw === '준비중' ||
      statusRaw === '상품 준비중'
    ) {
      return ORDER_STATUS.PREPARING;
    }

    if (statusRaw === ORDER_STATUS.SHIPPING || statusRaw === '배송중') {
      return ORDER_STATUS.SHIPPING;
    }

    if (statusRaw === ORDER_STATUS.DELIVERED || statusRaw === '배송완료') {
      return ORDER_STATUS.DELIVERED;
    }

    if (statusRaw === ORDER_STATUS.CANCEL_REQUESTED || statusRaw === '취소 요청') {
      return ORDER_STATUS.CANCEL_REQUESTED;
    }

    if (statusRaw === ORDER_STATUS.CANCEL_COMPLETED || statusRaw === '취소 완료') {
      return ORDER_STATUS.CANCEL_COMPLETED;
    }

    return ORDER_STATUS.RECEIVED;
  }

  private normalizePurchaseType(value?: string | null): 'member' | 'guest' {
    return value === 'member' ? 'member' : 'guest';
  }
}
