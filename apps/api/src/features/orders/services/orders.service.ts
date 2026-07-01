import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '../../config/services/config.service';
import { DataSource, EntityManager, In, LessThan, Like, QueryFailedError, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { OrderEntity } from '../../../database/entities/order.entity';
import { OrderItemEntity } from '../../../database/entities/order-item.entity';
import { ProductEntity } from '../../../database/entities/product.entity';
import { AccountEntity } from '../../../database/entities/account.entity';
import { CouponEntity } from '../../../database/entities/coupon.entity';
import { MileageTransactionEntity } from '../../../database/entities/mileage-transaction.entity';
import {
  CreateOrderInput,
  Order,
  OrderStatus,
  StoreConfig,
} from '../../../shared/store.types';
import { ORDER_STATUS } from '@repo/shared-types/order';
import {
  computeCouponDiscount,
  isCouponExpired,
  meetsCouponMinOrder,
} from '../../coupons/coupon.util';
import { randomBytes, randomInt } from 'node:crypto';
import { FirestoreTriggerService } from '../../../shared/firestore-trigger.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { MessagesService } from '../../messages/services/messages.service';

type PhoneCodeState = {
  code: string;
  expiresAt: number;
  attempts: number;
};

type VerifiedLookupState = {
  phone: string;
  expiresAt: number;
};

type GuestLookupPurpose = 'checkout' | 'lookup';

@Injectable()
export class OrdersService implements OnModuleInit, OnModuleDestroy {
  private static readonly ORDER_ID_RETRY_LIMIT = 3;
  private static readonly LOOKUP_CODE_EXPIRE_MS = 3 * 60 * 1000;
  private static readonly LOOKUP_TOKEN_EXPIRE_MS = 10 * 60 * 1000;
  private static readonly LOOKUP_MAX_VERIFY_ATTEMPTS = 5;
  private static readonly OVERDUE_CHECK_INTERVAL_MS = 5 * 60 * 1000;
  private static readonly PAYMENT_OVERDUE_CANCEL_REASON = '입금기한 지남';
  private static readonly CUSTOMER_CANCELLABLE_STATUSES: OrderStatus[] = [
    ORDER_STATUS.RECEIVED,
    ORDER_STATUS.PREPARING,
  ];

  private readonly guestLookupCodeStore = new Map<string, PhoneCodeState>();
  private readonly guestLookupVerifiedStore = new Map<string, VerifiedLookupState>();
  private readonly orderReceivedSmsInFlight = new Set<number>();
  private overdueTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(OrderEntity)
    private readonly orderRepository: Repository<OrderEntity>,
    @InjectRepository(AccountEntity)
    private readonly accountRepository: Repository<AccountEntity>,
    private readonly configService: ConfigService,
    private readonly firestoreTrigger: FirestoreTriggerService,
    private readonly notificationsService: NotificationsService,
    private readonly messagesService: MessagesService,
  ) {}

  onModuleInit(): void {
    // 서버 기동 직후 1회, 이후 주기적으로 입금기한 초과 주문을 자동 취소합니다.
    void this.cancelOverduePendingOrders();
    this.overdueTimer = setInterval(() => {
      void this.cancelOverduePendingOrders();
    }, OrdersService.OVERDUE_CHECK_INTERVAL_MS);
    // 타이머가 프로세스 종료를 막지 않도록 unref
    this.overdueTimer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.overdueTimer) {
      clearInterval(this.overdueTimer);
      this.overdueTimer = null;
    }
  }

  /**
   * 입금 기한(paymentDueAt)이 지난 '접수' 상태(미입금) 주문을 자동으로 취소 완료 처리합니다.
   * 취소 사유는 '입금기한 지남'이며, 차감했던 재고를 복구합니다.
   */
  async cancelOverduePendingOrders(): Promise<number> {
    const now = new Date();
    const overdueOrders = await this.orderRepository.find({
      where: {
        status: ORDER_STATUS.RECEIVED,
        paymentDueAt: LessThan(now),
      },
    });

    if (!overdueOrders.length) {
      return 0;
    }

    let cancelled = 0;
    for (const overdue of overdueOrders) {
      try {
        await this.dataSource.transaction(async (manager) => {
          const orderRepository = manager.getRepository(OrderEntity);

          const order = await orderRepository.findOne({
            where: { id: overdue.id },
            relations: { items: true },
          });

          // 그 사이 입금 확인/취소 등으로 상태가 바뀌었으면 건너뜁니다.
          if (
            !order ||
            this.normalizeOrderStatus(order.status) !== ORDER_STATUS.RECEIVED
          ) {
            return;
          }

          // 재고 복구 + 사용 쿠폰/적립금 복원
          await this.revertCancelledOrderEffects(manager, order);

          await orderRepository.save({
            ...order,
            status: ORDER_STATUS.CANCEL_COMPLETED,
            cancelReason: OrdersService.PAYMENT_OVERDUE_CANCEL_REASON,
            statusHistory: this.appendStatusHistory(order, ORDER_STATUS.CANCEL_COMPLETED),
          });
        });
        cancelled += 1;
      } catch (error) {
        // 개별 주문 실패는 로깅 후 다음 주문으로 진행합니다.
        console.error('[orders] 입금기한 자동취소 실패', overdue.id, error);
      }
    }

    if (cancelled > 0) {
      void this.firestoreTrigger.notify('orders');
    }

    return cancelled;
  }

  async createOrder(input: CreateOrderInput) {
    if (input.purchaseType === 'guest' && !input.skipGuestVerification) {
      const phone = this.normalizePhone(input.phone);
      this.assertPhoneFormat(phone);

      const lookupToken = input.lookupToken?.trim();
      if (!lookupToken) {
        throw new BadRequestException('비회원 주문은 휴대폰 문자 인증이 필요합니다.');
      }

      this.assertGuestLookupVerified(phone, lookupToken);
    }

    // 입금 기한: 기본정보의 paymentDueDays(일)를 주문 시점 기준으로 고정 저장합니다.
    const storeConfig = await this.configService.getStoreConfig();
      this.assertStoreOpenForOrder(storeConfig);
    const paymentDueAt =
      storeConfig.paymentDueDays > 0
        ? new Date(Date.now() + storeConfig.paymentDueDays * 24 * 60 * 60 * 1000)
        : null;
    // 배송료: 청구 설정이 켜져 있을 때만 부과
    const deliveryFee = storeConfig.chargeDeliveryFee
      ? Math.max(0, Math.floor(storeConfig.deliveryFee || 0))
      : 0;
    // 회원 사은품: 회원 주문일 때만, 설정된 상품을 0원으로 함께 발송 (재고 차감 안 함)
    const memberBonusProductId =
      input.purchaseType === 'member' && !input.excludeMemberBonus
        ? storeConfig.memberBonusProductId
        : null;
    // 쿠폰/적립금은 회원 전용. accountId가 있는 회원 주문에만 적용한다.
    const memberAccountId =
      input.purchaseType === 'member' && typeof input.accountId === 'number'
        ? input.accountId
        : null;
    const requestedMileage = Math.max(0, Math.floor(Number(input.mileageToUse) || 0));
    const requestedCouponId =
      typeof input.couponId === 'number' && input.couponId > 0
        ? input.couponId
        : null;

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

          // 회원 사은품: 설정된 상품을 0원 항목으로 추가. 사은품 전용 숨김 상품(active=false)도 허용하므로 active 조건은 두지 않는다. 재고는 차감하지 않으며 결제 금액에도 더하지 않는다.
          const bonusItems: typeof normalizedItems = [];
          if (memberBonusProductId) {
            const bonusProduct = await productRepository.findOne({
              where: { id: memberBonusProductId },
            });

            if (bonusProduct) {
              bonusItems.push({
                productId: bonusProduct.id,
                productName: bonusProduct.name,
                unitPrice: 0,
                quantity: 1,
                subtotal: 0,
              });
            }
          }

          const itemsSubtotal = normalizedItems.reduce(
            (sum, item) => sum + item.subtotal,
            0,
          );

          // 회원 전용: 쿠폰 할인 / 적립금 사용 계산 및 검증
          const couponRepository = manager.getRepository(CouponEntity);
          const mileageRepository = manager.getRepository(MileageTransactionEntity);
          const accountRepository = manager.getRepository(AccountEntity);

          let couponDiscount = 0;
          let appliedCoupon: CouponEntity | null = null;
          let mileageUsed = 0;
          let memberAccount: AccountEntity | null = null;

          if (memberAccountId) {
            if (requestedCouponId) {
              const coupon = await couponRepository.findOne({
                where: {
                  id: requestedCouponId,
                  accountId: memberAccountId,
                  status: 'available',
                },
              });
              if (!coupon) {
                throw new BadRequestException('사용할 수 없는 쿠폰입니다.');
              }
              if (isCouponExpired(coupon.validUntil)) {
                throw new BadRequestException('만료된 쿠폰입니다.');
              }
              if (!meetsCouponMinOrder(coupon, itemsSubtotal)) {
                throw new BadRequestException(
                  `이 쿠폰은 ${coupon.minOrderAmount.toLocaleString()}원 이상 주문 시 사용할 수 있습니다.`,
                );
              }
              couponDiscount = computeCouponDiscount(coupon, itemsSubtotal);
              appliedCoupon = coupon;
            }

            if (requestedMileage > 0) {
              memberAccount = await accountRepository.findOne({
                where: { id: memberAccountId },
              });
              if (!memberAccount) {
                throw new NotFoundException('주문자 계정을 찾을 수 없습니다.');
              }
              const payableBeforeMileage = Math.max(
                0,
                itemsSubtotal + deliveryFee - couponDiscount,
              );
              // 잔액과 결제 예정액을 넘지 않도록 사용액을 제한
              mileageUsed = Math.min(
                requestedMileage,
                memberAccount.mileageBalance ?? 0,
                payableBeforeMileage,
              );
            }
          }

          const totalAmount = Math.max(
            0,
            itemsSubtotal + deliveryFee - couponDiscount - mileageUsed,
          );

          const created = await orderRepository.save(
            orderRepository.create({
              id: await this.createOrderId(orderRepository),
              accountId: input.accountId ?? null,
              customerName: input.customerName,
              phone: input.phone,
              shippingAddress: input.shippingAddress,
              requestNote: input.requestNote?.trim() || null,
              depositorName: input.depositorName,
              purchaseType: input.purchaseType === 'member' ? 'member' : 'guest',
              status: ORDER_STATUS.RECEIVED,
              deliveryFee,
              couponId: appliedCoupon ? appliedCoupon.id : null,
              couponDiscount,
              mileageUsed,
              mileageEarned: 0,
              totalAmount,
              paymentDueAt,
              statusHistory: [
                { status: ORDER_STATUS.RECEIVED, at: new Date().toISOString() },
              ],
            }),
          );

          // 쿠폰 사용 처리
          if (appliedCoupon) {
            appliedCoupon.status = 'used';
            appliedCoupon.usedOrderId = created.id;
            appliedCoupon.usedAt = new Date();
            await couponRepository.save(appliedCoupon);
          }

          // 적립금 차감 + 원장 기록
          if (mileageUsed > 0 && memberAccount && memberAccountId) {
            const nextBalance = (memberAccount.mileageBalance ?? 0) - mileageUsed;
            memberAccount.mileageBalance = nextBalance;
            await accountRepository.save(memberAccount);
            await mileageRepository.save(
              mileageRepository.create({
                accountId: memberAccountId,
                amount: -mileageUsed,
                type: 'use',
                orderId: created.id,
                reason: null,
                balanceAfter: nextBalance,
              }),
            );
          }

          await orderItemRepository.save(
            [...normalizedItems, ...bonusItems].map((item) =>
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
        if (!input.skipGuestVerification) {
          void this.sendOrderReceivedSms(order);
          void this.notifyAdminOrderCreatedSms(order);
        }
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

  async createBackofficeOrder(
    input: Omit<CreateOrderInput, 'lookupToken' | 'skipGuestVerification'>,
  ): Promise<Order> {
    const purchaseType = input.purchaseType === 'guest' ? 'guest' : 'member';

    let accountId: number | null = null;
    if (purchaseType === 'member') {
      if (typeof input.accountId !== 'number' || Number.isNaN(input.accountId)) {
        throw new BadRequestException('회원 주문은 주문자 계정을 선택해주세요.');
      }

      const account = await this.accountRepository.findOne({
        where: { id: input.accountId },
      });
      if (!account) {
        throw new NotFoundException('선택한 계정을 찾을 수 없습니다.');
      }

      accountId = account.id;
    }

    const result = await this.createOrder({
      ...input,
      accountId,
      purchaseType,
      // 관리자 직접 등록은 휴대폰 인증 없이 처리합니다.
      skipGuestVerification: true,
    });

    return result.order;
  }

  async updateBackofficeOrder(
    id: number,
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

  async deleteBackofficeOrder(id: number): Promise<{ ok: true }> {
    await this.dataSource.transaction(async (manager) => {
      const orderRepository = manager.getRepository(OrderEntity);

      const order = await orderRepository.findOne({
        where: { id },
        relations: { items: true },
      });

      if (!order) {
        throw new NotFoundException('주문을 찾을 수 없습니다.');
      }

      if (this.normalizeOrderStatus(order.status) !== ORDER_STATUS.CANCEL_COMPLETED) {
        await this.revertCancelledOrderEffects(manager, order);
      }

      await orderRepository.delete({ id: order.id });
    });

    await this.notificationsService.deleteOrderNotifications(id);
    void this.firestoreTrigger.notify('orders');

    return { ok: true };
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

  async getOrderById(id: number): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { id },
      relations: { items: true },
    });

    if (!order) {
      throw new NotFoundException('주문을 찾을 수 없습니다.');
    }

    return this.toOrder(order);
  }

  async updateOrderStatus(id: number, status: OrderStatus): Promise<Order> {
    const storeConfig = await this.configService.getStoreConfig();
    const mileageEarnRate = Math.max(0, Math.floor(storeConfig.mileageEarnRate || 0));
    let shouldSendStatusSms = false;

    const updated = await this.dataSource.transaction(async (manager) => {
      const orderRepository = manager.getRepository(OrderEntity);
      const mileageRepository = manager.getRepository(MileageTransactionEntity);
      const accountRepository = manager.getRepository(AccountEntity);

      const order = await orderRepository.findOne({
        where: { id },
        relations: { items: true },
      });
      if (!order) {
        throw new NotFoundException('주문을 찾을 수 없습니다.');
      }

      const currentStatus = this.normalizeOrderStatus(order.status);
      shouldSendStatusSms =
        status !== currentStatus &&
        (status === ORDER_STATUS.PAID || status === ORDER_STATUS.SHIPPING);

      if (currentStatus === ORDER_STATUS.CANCEL_COMPLETED && status !== ORDER_STATUS.CANCEL_COMPLETED) {
        throw new BadRequestException('취소 완료된 주문은 상태를 변경할 수 없습니다.');
      }

      if (status === ORDER_STATUS.CANCEL_COMPLETED && currentStatus !== ORDER_STATUS.CANCEL_COMPLETED) {
        await this.revertCancelledOrderEffects(manager, order);
      }

      // 배송완료 시 적립금 자동 적립 (회원 주문, 1회만)
      if (
        status === ORDER_STATUS.DELIVERED &&
        currentStatus !== ORDER_STATUS.DELIVERED &&
        order.accountId &&
        (order.mileageEarned ?? 0) === 0 &&
        mileageEarnRate > 0
      ) {
        const alreadyEarned = await mileageRepository.findOne({
          where: { orderId: order.id, type: 'earn' },
        });
        if (!alreadyEarned) {
          const earned = Math.floor((order.totalAmount * mileageEarnRate) / 100);
          if (earned > 0) {
            const account = await accountRepository.findOne({
              where: { id: order.accountId },
            });
            if (account) {
              const nextBalance = (account.mileageBalance ?? 0) + earned;
              account.mileageBalance = nextBalance;
              await accountRepository.save(account);
              await mileageRepository.save(
                mileageRepository.create({
                  accountId: order.accountId,
                  amount: earned,
                  type: 'earn',
                  orderId: order.id,
                  reason: null,
                  balanceAfter: nextBalance,
                }),
              );
              order.mileageEarned = earned;
            }
          }
        }
      }

      return orderRepository.save({
        ...order,
        status,
        cancelReason: (status === ORDER_STATUS.CANCEL_REQUESTED || status === ORDER_STATUS.CANCEL_COMPLETED) ? order.cancelReason : null,
        statusHistory:
          status === currentStatus
            ? order.statusHistory ?? []
            : this.appendStatusHistory(order, status),
      });
    });

    await this.notificationsService.createNotification({
      title: '주문 취소 요청이 접수되었습니다.',
      content: `${updated.customerName} 님 주문 ${updated.id}`,
      type: 'order',
      url: '/orders',
    });

    if (shouldSendStatusSms) {
      void this.sendOrderStatusSms(updated);
    }

    void this.firestoreTrigger.notify('orders');
    return this.toOrder(updated);
  }

  async cancelOrderByCustomer(input: {
    id: number;
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
        statusHistory: this.appendStatusHistory(order, ORDER_STATUS.CANCEL_REQUESTED),
      });
    });

    void this.firestoreTrigger.notify('orders');
    return this.toOrder(updated);
  }

  async requestGuestOrderLookup(
    phoneRaw: string,
    purpose: GuestLookupPurpose = 'lookup',
  ) {
    const phone = this.normalizePhone(phoneRaw);
    this.assertPhoneFormat(phone);

    const existingAccount = await this.accountRepository.findOne({
      where: { phone },
    });

    const isMasterCheckoutException =
      purpose === 'checkout' &&
      existingAccount?.type?.toUpperCase() === 'MASTER';

    if (existingAccount && !isMasterCheckoutException) {
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

    await this.sendPhoneCode(phone, code, purpose);

    return {
      ok: true,
      expiresAt: new Date(expiresAt).toISOString(),
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

  private async createOrderId(orderRepository: Repository<OrderEntity>): Promise<number> {
    // 주문번호 = YYYYMMDD + 5자리 시퀀스 (예: 2026061500001)
    const datePrefix = this.getKstDatePrefix();
    const dayBase = Number(datePrefix) * 100000;

    const latestOrder = await orderRepository
      .createQueryBuilder('order')
      .select('MAX(order.id)', 'maxId')
      .where('order.id >= :min', { min: dayBase })
      .andWhere('order.id < :max', { max: dayBase + 100000 })
      .getRawOne<{ maxId: string | null }>();

    const nextSequence = latestOrder?.maxId
      ? Number(latestOrder.maxId) - dayBase + 1
      : 1;

    if (!Number.isFinite(nextSequence) || nextSequence < 1 || nextSequence > 99999) {
      throw new BadRequestException('주문번호 시퀀스를 계산할 수 없습니다.');
    }

    return dayBase + nextSequence;
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
    purpose: GuestLookupPurpose,
  ): Promise<void> {
    const verificationContext =
      purpose === 'checkout' ? '비회원 주문 인증번호' : '주문조회 인증번호';
    const receiverName = purpose === 'checkout' ? '웹 비회원 주문인증' : '웹 주문조회 인증';
    try {
      await this.messagesService.sendSms({
        receiver: phone,
        receiverName,
        content: `${verificationContext} [${code}]를 입력해주세요.`,
      });
    } catch (error) {
      const smsErrorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
      throw new BadRequestException(`문자 발송에 실패했습니다. ${smsErrorMessage}`);
    }
  }

  private async sendOrderStatusSms(order: OrderEntity): Promise<void> {
    const status = this.normalizeOrderStatus(order.status);
    if (status !== ORDER_STATUS.PAID && status !== ORDER_STATUS.SHIPPING) {
      return;
    }

    const message =
      status === ORDER_STATUS.PAID
        ? `${order.customerName}님 ${order.totalAmount}원 입금이 확인되었습니다. 감사합니다.`
        : '배송이 시작되었습니다. 택배사로부터 자세한 배송 정보를 얻으실 수 있습니다. 감사합니다.';

    try {
      await this.messagesService.sendSms({
        receiver: this.normalizePhone(order.phone),
        content: message,
      });
    } catch (error) {
      console.warn('[orders] 상태변경 문자 발송 실패', {
        orderId: order.id,
        status,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async sendOrderReceivedSms(order: OrderEntity): Promise<void> {
    if (this.orderReceivedSmsInFlight.has(order.id)) {
      return;
    }

    this.orderReceivedSmsInFlight.add(order.id);
    try {
      const storeConfig = await this.configService.getStoreConfig();
      const shopName = storeConfig.shopName.trim() || '상점';
      const prefix = `[${shopName}]`;
      const dueAtText = order.paymentDueAt
        ? this.formatSmsDateTime(order.paymentDueAt)
        : '-';
      const amountText = `${Math.max(0, Math.floor(order.totalAmount)).toLocaleString('ko-KR')}원`;
      const bankName = (storeConfig.bankName ?? '').trim() || '-';
      const accountHolder = (storeConfig.accountHolder ?? '').trim() || '-';
      const accountNumber = (storeConfig.accountNumber ?? '').trim() || '-';

      const compactDueAt = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(dueAtText)
        ? dueAtText.slice(5)
        : dueAtText;
      const compactBank = this.truncateByByte(bankName, 16);
      const compactAccount = this.truncateByByte(accountNumber, 24);
      const compactHolder = this.truncateByByte(accountHolder, 16);

      const messageCandidates = [
        `${prefix}${amountText}/입금기한 ${compactDueAt}/${compactBank}/${compactAccount}/${compactHolder} 감사합니다.`,
        `${prefix}${amountText}/입금기한 ${compactDueAt}/${compactBank}/${compactAccount} 감사합니다.`,
        `${prefix}${amountText}/입금기한 ${compactDueAt}/${compactAccount} 감사합니다.`,
        `${prefix}${amountText}/입금기한 ${compactDueAt} 감사합니다.`,
        `${prefix}${amountText}/입금기한 ${compactDueAt}`,
      ];

      const selected =
        messageCandidates.find((item) => this.smsByteLength(item) <= 90) ?? messageCandidates[messageCandidates.length - 1];
      const message = this.truncateByByte(selected, 90);

      try {
        await this.messagesService.sendSms({
          receiver: this.normalizePhone(order.phone),
          content: message,
        });
      } catch (error) {
        console.warn('[orders] 주문접수 문자 발송 실패', {
          orderId: order.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    } finally {
      this.orderReceivedSmsInFlight.delete(order.id);
    }
  }

  private formatSmsDateTime(value: Date | string): string {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '-';
    }

    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(date);

    const year = parts.find((part) => part.type === 'year')?.value ?? '0000';
    const month = parts.find((part) => part.type === 'month')?.value ?? '00';
    const day = parts.find((part) => part.type === 'day')?.value ?? '00';
    const hour = parts.find((part) => part.type === 'hour')?.value ?? '00';
    const minute = parts.find((part) => part.type === 'minute')?.value ?? '00';

    return `${year}-${month}-${day} ${hour}:${minute}`;
  }

  private smsByteLength(content: string): number {
    return Array.from(content).reduce((sum, ch) => {
      return sum + (/[^\u0000-\u007f]/.test(ch) ? 2 : 1);
    }, 0);
  }

  private truncateByByte(content: string, maxBytes: number): string {
    const chars = Array.from(content);
    let used = 0;
    let out = '';

    for (const ch of chars) {
      const chBytes = /[^\u0000-\u007f]/.test(ch) ? 2 : 1;
      if (used + chBytes > maxBytes) {
        break;
      }
      out += ch;
      used += chBytes;
    }

    return out;
  }

  private async notifyAdminOrderCreatedSms(order: OrderEntity): Promise<void> {
    try {
      const config = await this.configService.getStoreConfig();
      const shopName = config.shopName.trim() || '상점';
      const receiver = this.normalizePhone(config.sellerPhone ?? '');
      const customerReceiver = this.normalizePhone(order.phone);
      if (!/^\d{8,20}$/.test(receiver)) {
        return;
      }
      if (receiver === customerReceiver) {
        return;
      }

      const paidItems = (order.items ?? [])
        .filter((item) => item.subtotal > 0)
        .filter((item) => item.quantity > 0);
      const totalQty = paidItems.reduce((sum, item) => sum + Math.max(0, item.quantity), 0);
      const firstItem = paidItems[0];
      const firstName = firstItem?.productName?.trim() || '상품';
      const shortName = Array.from(firstName).slice(0, 10).join('');
      const productSummary =
        paidItems.length <= 1
          ? `${shortName} ${Math.max(0, totalQty)}개`
          : `${shortName} 외 ${Math.max(0, totalQty - Math.max(0, firstItem.quantity))}개`;
      const amountText = `${Math.max(0, Math.floor(order.totalAmount)).toLocaleString('ko-KR')}원`;
      const prefix = `[${shopName}] `;
      const templates = [
        `신규주문접수 ${productSummary} 금액${amountText}`,
        `신규주문 ${productSummary} 금액${amountText}`,
        `주문 ${productSummary} 금액${amountText}`,
        `${productSummary} 금액${amountText}`,
        `금액${amountText}`,
      ];
      const content =
        templates.find((text) => this.smsByteLength(`${prefix}${text}`) <= 90) ?? templates[templates.length - 1];

      await this.messagesService.sendSms({
        receiver,
        content,
      });
    } catch (error) {
      console.warn('[orders] 관리자 주문 알림 문자 발송 실패', {
        error: error instanceof Error ? error.message : String(error),
      });
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
      accountId: order.accountId ?? null,
      customerName: order.customerName,
      purchaseType: this.normalizePurchaseType(order.purchaseType),
      phone: order.phone,
      shippingAddress: order.shippingAddress,
      requestNote: order.requestNote,
      cancelReason: order.cancelReason,
      depositorName: order.depositorName,
      status,
      deliveryFee: order.deliveryFee ?? 0,
      couponId: order.couponId ?? null,
      couponDiscount: order.couponDiscount ?? 0,
      mileageUsed: order.mileageUsed ?? 0,
      mileageEarned: order.mileageEarned ?? 0,
      totalAmount: order.totalAmount,
      createdAt: order.createdAt.toISOString(),
      paymentDueAt: order.paymentDueAt ? order.paymentDueAt.toISOString() : null,
      statusHistory: (Array.isArray(order.statusHistory) ? order.statusHistory : []).map(
        (entry) => ({
          status: this.normalizeOrderStatus(entry.status),
          at: entry.at,
        }),
      ),
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

  private appendStatusHistory(
    order: OrderEntity,
    status: OrderStatus,
  ): { status: string; at: string }[] {
    const history = Array.isArray(order.statusHistory) ? order.statusHistory : [];
    return [...history, { status, at: new Date().toISOString() }];
  }

  // 주문 취소 완료 시: 재고 복구 + 사용 적립금 복원 + 적립 적립금 회수 + 사용 쿠폰 복원
  private async revertCancelledOrderEffects(
    manager: EntityManager,
    order: OrderEntity,
  ): Promise<void> {
    const productRepository = manager.getRepository(ProductEntity);
    const couponRepository = manager.getRepository(CouponEntity);
    const mileageRepository = manager.getRepository(MileageTransactionEntity);
    const accountRepository = manager.getRepository(AccountEntity);

    // 재고 복구 (회원 사은품 0원 항목은 주문 시 차감하지 않았으므로 제외)
    for (const item of order.items ?? []) {
      if ((item.unitPrice ?? 0) <= 0) {
        continue;
      }
      await productRepository
        .createQueryBuilder()
        .update(ProductEntity)
        .set({ stock: () => `stock + ${item.quantity}` })
        .where('id = :id', { id: item.productId })
        .execute();
    }

    if (!order.accountId) {
      return;
    }

    const account = await accountRepository.findOne({
      where: { id: order.accountId },
    });
    if (account) {
      let balance = account.mileageBalance ?? 0;
      // 사용한 적립금 복원
      if ((order.mileageUsed ?? 0) > 0) {
        balance += order.mileageUsed;
        await mileageRepository.save(
          mileageRepository.create({
            accountId: order.accountId,
            amount: order.mileageUsed,
            type: 'restore',
            orderId: order.id,
            reason: '주문 취소 - 사용 적립금 복원',
            balanceAfter: balance,
          }),
        );
      }
      // 적립된 적립금 회수 (잔액 0 미만 클램프)
      if ((order.mileageEarned ?? 0) > 0) {
        const reclaim = Math.min(order.mileageEarned, balance);
        if (reclaim > 0) {
          balance -= reclaim;
          await mileageRepository.save(
            mileageRepository.create({
              accountId: order.accountId,
              amount: -reclaim,
              type: 'restore',
              orderId: order.id,
              reason: '주문 취소 - 적립 적립금 회수',
              balanceAfter: balance,
            }),
          );
        }
      }
      account.mileageBalance = balance;
      await accountRepository.save(account);
    }

    // 사용한 쿠폰 복원
    if (order.couponId) {
      const coupon = await couponRepository.findOne({
        where: { id: order.couponId },
      });
      if (coupon && coupon.status === 'used' && coupon.usedOrderId === order.id) {
        coupon.status = 'available';
        coupon.usedOrderId = null;
        coupon.usedAt = null;
        await couponRepository.save(coupon);
      }
    }
  }

  private assertStoreOpenForOrder(config: StoreConfig): void {
    if (config.businessStatus === 'open') {
      return;
    }

    if (config.businessStatus === 'standby') {
      throw new BadRequestException(
        config.businessStatusStandbyText ||
          '현재 영업 준비 중입니다. 잠시 후 다시 주문해주세요.',
      );
    }

    throw new BadRequestException(
      config.businessStatusClosedText ||
        '현재 영업이 종료되어 주문이 불가능합니다.',
    );
  }
}
