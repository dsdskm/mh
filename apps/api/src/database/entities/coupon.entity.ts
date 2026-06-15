import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AccountEntity } from './account.entity';
import { bigintTransformer } from '../column-transformers';
import type {
  CouponDiscountType,
  CouponStatus,
} from '@repo/shared-types/coupon';

// 한 행 = 한 회원이 보유한 쿠폰 1장
@Entity({ name: 'coupons' })
export class CouponEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index()
  @Column({ type: 'int' })
  accountId!: number;

  @ManyToOne(() => AccountEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'accountId' })
  account!: AccountEntity;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'varchar' })
  discountType!: CouponDiscountType;

  // fixed: 할인 원, percent: 할인 퍼센트(%)
  @Column({ type: 'int' })
  discountValue!: number;

  @Column({ type: 'int', default: 0 })
  minOrderAmount!: number;

  // 정률 할인 상한 (없으면 null)
  @Column({ type: 'int', nullable: true })
  maxDiscountAmount!: number | null;

  @Column({ type: 'timestamptz', nullable: true })
  validUntil!: Date | null;

  @Column({ type: 'varchar', default: 'available' })
  status!: CouponStatus;

  @Column({ type: 'bigint', nullable: true, transformer: bigintTransformer })
  usedOrderId!: number | null;

  @Column({ type: 'timestamptz', nullable: true })
  usedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  issuedAt!: Date;
}
