import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export const NOTIFICATION_TYPE_VALUES = [
  'order',
  'review',
  'inquiry',
  'review-comment',
  'inquiry-comment',
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPE_VALUES)[number];

@Entity({ name: 'notifications' })
export class NotificationEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar' })
  title!: string;

  @Column({ type: 'text' })
  content!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @Column({ type: 'varchar' })
  type!: NotificationType;

  @Column({ type: 'boolean', default: false })
  isRead!: boolean;

  @Column({ type: 'varchar' })
  url!: string;
}
