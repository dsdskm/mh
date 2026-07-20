import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type AccountType = 'NORMAL' | 'KAKAO' | 'NAVER' | 'MASTER';
export type AccountStatus = 'active' | 'deactive' | 'withdraw';

@Entity({ name: 'accounts' })
@Index(['type', 'providerUserId'], { unique: true })
@Index(['userId'], { unique: true })
@Index(['phone'], { unique: true })
export class AccountEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', nullable: true })
  userId!: string | null;

  @Column({ type: 'varchar' })
  type!: AccountType;

  @Column({ type: 'varchar', nullable: true })
  username!: string | null;

  @Column({ type: 'varchar', nullable: true })
  password!: string | null;

  @Column({ type: 'varchar', nullable: true })
  providerUserId!: string | null;

  @Column({ type: 'varchar', nullable: true })
  email!: string | null;

  @Column({ type: 'varchar', nullable: true })
  displayName!: string | null;

  @Column({ type: 'varchar', nullable: true })
  phone!: string | null;

  @Column({ type: 'varchar', nullable: true })
  address1!: string | null;

  @Column({ type: 'varchar', nullable: true })
  address2!: string | null;

  @Column({ type: 'varchar', default: 'active' })
  status!: AccountStatus;

  @Column({ type: 'varchar', nullable: true })
  statusReason!: string | null;

  @Column({ type: 'boolean', default: false })
  termsAgreed!: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  termsAgreedAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  phoneVerifiedAt!: Date | null;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  // 적립금(마일리지) 잔액. 원장은 mileage_transactions 에 기록
  @Column({ type: 'int', default: 0 })
  mileageBalance!: number;

  @Column({ name: 'kakao_nickname', type: 'varchar', nullable: true })
  kakaoNickname!: string | null;

  @Column({ name: 'kakao_profile_image_url', type: 'varchar', nullable: true })
  kakaoProfileImageUrl!: string | null;

  @Column({ name: 'kakao_thumbnail_image_url', type: 'varchar', nullable: true })
  kakaoThumbnailImageUrl!: string | null;

  @Column({ name: 'kakao_shipping_name', type: 'varchar', nullable: true })
  kakaoShippingName!: string | null;

  @Column({ name: 'kakao_shipping_receiver_name', type: 'varchar', nullable: true })
  kakaoShippingReceiverName!: string | null;

  @Column({ name: 'kakao_shipping_receiver_phone1', type: 'varchar', nullable: true })
  kakaoShippingReceiverPhone1!: string | null;

  @Column({ name: 'kakao_shipping_receiver_phone2', type: 'varchar', nullable: true })
  kakaoShippingReceiverPhone2!: string | null;

  @Column({ name: 'kakao_shipping_zone_number', type: 'varchar', nullable: true })
  kakaoShippingZoneNumber!: string | null;

  @Column({ name: 'kakao_synced_at', type: 'timestamptz', nullable: true })
  kakaoSyncedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
