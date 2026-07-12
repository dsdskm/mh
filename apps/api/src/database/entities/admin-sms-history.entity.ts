import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export const ADMIN_SMS_STATUS_VALUES = ['success', 'failed', 'cancelled'] as const;
export type AdminSmsStatus = (typeof ADMIN_SMS_STATUS_VALUES)[number];
export const ADMIN_MESSAGE_CHANNEL_VALUES = ['sms', 'kakao'] as const;
export type AdminMessageChannel = (typeof ADMIN_MESSAGE_CHANNEL_VALUES)[number];

@Entity({ name: 'admin_sms_histories' })
export class AdminSmsHistoryEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @Column({ type: 'varchar', length: 10 })
  corpNum!: string;

  @Column({ type: 'varchar', length: 20 })
  sender!: string;

  @Column({ type: 'varchar', length: 70, nullable: true })
  senderName!: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  userID!: string | null;

  @Column({ type: 'varchar', length: 20 })
  receiver!: string;

  @Column({ type: 'varchar', length: 70, nullable: true })
  receiverName!: string | null;

  @Column({ type: 'text' })
  content!: string;

  @Column({ type: 'varchar', length: 14, nullable: true })
  reserveDT!: string | null;

  @Column({ type: 'boolean', default: false })
  adsYN!: boolean;

  @Column({ type: 'varchar', length: 64, nullable: true })
  receiptNum!: string | null;

  @Column({ type: 'varchar', length: 16, default: 'sms' })
  channel!: AdminMessageChannel;

  @Column({ type: 'varchar', length: 64, nullable: true })
  templateId!: string | null;

  @Column({ type: 'varchar', length: 12 })
  status!: AdminSmsStatus;

  @Column({ type: 'text', nullable: true })
  errorMessage!: string | null;
}
