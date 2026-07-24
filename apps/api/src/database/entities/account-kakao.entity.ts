import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AccountEntity } from './account.entity';

@Entity({ name: 'accounts_kakao' })
@Index(['accountId'], { unique: true })
export class AccountKakaoEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int', name: 'account_id' })
  accountId!: number;

  @OneToOne(() => AccountEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'account_id' })
  account!: AccountEntity;

  @Column({ type: 'varchar', name: 'provider_user_id', nullable: true })
  providerUserId!: string | null;

  @Column({ type: 'jsonb', name: 'raw_user', nullable: true })
  rawUser!: Record<string, unknown> | null;

  @Column({ type: 'jsonb', name: 'raw_shipping', nullable: true })
  rawShipping!: Record<string, unknown> | null;

  @Column({ type: 'varchar', nullable: true })
  nickname!: string | null;

  @Column({ type: 'varchar', name: 'profile_image_url', nullable: true })
  profileImageUrl!: string | null;

  @Column({ type: 'varchar', name: 'profile_thumbnail_url', nullable: true })
  profileThumbnailUrl!: string | null;

  @Column({ type: 'varchar', name: 'shipping_name', nullable: true })
  shippingName!: string | null;

  @Column({ type: 'varchar', name: 'shipping_receiver_name', nullable: true })
  shippingReceiverName!: string | null;

  @Column({ type: 'varchar', name: 'shipping_receiver_phone1', nullable: true })
  shippingReceiverPhone1!: string | null;

  @Column({ type: 'varchar', name: 'shipping_receiver_phone2', nullable: true })
  shippingReceiverPhone2!: string | null;

  @Column({ type: 'varchar', name: 'shipping_postal_code', nullable: true })
  shippingPostalCode!: string | null;

  @Column({ type: 'timestamptz', name: 'synced_at', nullable: true })
  syncedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
