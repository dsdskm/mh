import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
} from 'typeorm';
import { OrderItemEntity } from './order-item.entity';
import { AccountEntity } from './account.entity';
import { bigintTransformer } from '../column-transformers';

@Entity({ name: 'orders' })
export class OrderEntity {
  @PrimaryColumn({ type: 'bigint', transformer: bigintTransformer })
  id!: number;

  @Index()
  @Column({ type: 'int', nullable: true })
  accountId!: number | null;

  @ManyToOne(() => AccountEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'accountId' })
  account!: AccountEntity | null;

  @Column({ type: 'varchar' })
  customerName!: string;

  @Column({ type: 'varchar' })
  phone!: string;

  @Column({ type: 'varchar', nullable: true })
  recipientPhone!: string | null;

  @Column({ type: 'varchar' })
  shippingAddress!: string;

  @Column({ type: 'varchar', nullable: true })
  requestNote!: string | null;

  @Column({ type: 'varchar' })
  depositorName!: string;

  @Column({ type: 'varchar', default: 'guest' })
  purchaseType!: 'member' | 'guest';

  @Column({ type: 'varchar' })
  status!: string;

  @Column({ type: 'text', nullable: true })
  cancelReason!: string | null;

  @Column({ type: 'int', default: 0 })
  deliveryFee!: number;

  // 사용한 쿠폰 id (없으면 null) 및 쿠폰 할인액
  @Column({ type: 'int', nullable: true })
  couponId!: number | null;

  @Column({ type: 'int', default: 0 })
  couponDiscount!: number;

  // 결제 시 사용한 적립금
  @Column({ type: 'int', default: 0 })
  mileageUsed!: number;

  // 배송완료 시 적립된 적립금 (0이면 아직 적립 안 됨)
  @Column({ type: 'int', default: 0 })
  mileageEarned!: number;

  // 실 결제액 = 상품소계 + 배송료 - 쿠폰할인 - 적립금사용
  @Column({ type: 'int' })
  totalAmount!: number;

  @Column({ type: 'timestamptz', nullable: true })
  paymentDueAt!: Date | null;

  // 상태가 바뀔 때마다 { status, at } 를 누적 기록 (처리 시각 표시용)
  @Column({ type: 'jsonb', default: () => "'[]'" })
  statusHistory!: { status: string; at: string }[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @OneToMany(() => OrderItemEntity, (orderItem) => orderItem.order, {
    cascade: true,
  })
  items!: OrderItemEntity[];
}
