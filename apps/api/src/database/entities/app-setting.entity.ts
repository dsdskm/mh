import { Column, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import {
  StoreRecipe,
  StoreStoryImage,
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

  @Column({ type: 'varchar', default: '' })
  trusteeBusinessName!: string;

  @Column({ type: 'varchar', default: '' })
  trusteeBusinessNumber!: string;

  @Column({ type: 'varchar', default: '' })
  trusteeRepresentative!: string;

  @Column({ type: 'varchar', default: '' })
  trusteePhone!: string;

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

  @Column({ type: 'varchar', default: 'open' })
  businessStatus!: 'open' | 'standby' | 'closed';

  @Column({ type: 'text', default: '현재 정상 영업 중입니다.' })
  businessStatusOpenText!: string;

  @Column({ type: 'text', default: '영업 준비 중입니다. 잠시 후 다시 방문해주세요.' })
  businessStatusStandbyText!: string;

  @Column({ type: 'text', default: '영업이 종료되었습니다. 다음 영업 시간에 주문 가능합니다.' })
  businessStatusClosedText!: string;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
