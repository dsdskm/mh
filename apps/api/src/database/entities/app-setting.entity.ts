import { Column, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import {
  StoreRecipe,
  StoreStoryImage,
  StoreTermsHistoryItem,
} from '../../shared/store.types';

@Entity({ name: 'app_settings' })
export class AppSettingEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar' })
  shopName!: string;

  @Column({ type: 'varchar' })
  sellerName!: string;

  @Column({ type: 'varchar' })
  sellerPhone!: string;

  @Column({ type: 'varchar' })
  origin!: string;

  @Column({ type: 'varchar' })
  bankName!: string;

  @Column({ type: 'varchar' })
  accountNumber!: string;

  @Column({ type: 'varchar' })
  accountHolder!: string;

  @Column({ type: 'varchar' })
  transferNote!: string;

  @Column({ type: 'text' })
  detailDescription!: string;

  @Column({ type: 'jsonb' })
  storyImages!: StoreStoryImage[];

  @Column({ type: 'varchar' })
  videoUrl!: string;

  @Column({ type: 'jsonb' })
  recipes!: StoreRecipe[];

  @Column({ type: 'varchar', default: '' })
  termsUrl!: string;

  @Column({ type: 'varchar', default: '' })
  termsVersion!: string;

  @Column({ type: 'timestamptz', nullable: true })
  termsUpdatedAt!: Date | null;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  termsHistory!: StoreTermsHistoryItem[];

  @Column({ type: 'int', default: 0 })
  paymentDueDays!: number;

  @Column({ type: 'int', default: 0 })
  deliveryFee!: number;

  @Column({ type: 'boolean', default: false })
  chargeDeliveryFee!: boolean;

  // 회원 주문 시 무료로 함께 발송할 사은품 상품 ID (없으면 null)
  @Column({ type: 'int', nullable: true })
  memberBonusProductId!: number | null;

  // 마일리지 적립률(%). 0이면 자동 적립 안 함. 주문 배송완료 시 결제액 × 비율로 적립
  @Column({ type: 'int', default: 0 })
  mileageEarnRate!: number;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
