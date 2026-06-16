import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { CouponDiscountType } from '@repo/shared-types/coupon';

@Entity({ name: 'coupon_templates' })
export class CouponTemplateEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'varchar' })
  discountType!: CouponDiscountType;

  @Column({ type: 'int' })
  discountValue!: number;

  @Column({ type: 'int', default: 0 })
  minOrderAmount!: number;

  @Column({ type: 'int', nullable: true })
  maxDiscountAmount!: number | null;

  @Column({ type: 'timestamptz', nullable: true })
  validUntil!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}