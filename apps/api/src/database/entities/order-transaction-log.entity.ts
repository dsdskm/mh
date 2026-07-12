import { bigintTransformer } from '../column-transformers';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export const ORDER_TRANSACTION_EVENT_VALUES = [
  'order_created',
  'order_updated',
  'order_deleted',
  'status_changed',
  'cancel_requested',
  'auto_cancelled',
] as const;

export type OrderTransactionEvent =
  (typeof ORDER_TRANSACTION_EVENT_VALUES)[number];

export const ORDER_TRANSACTION_ACTOR_VALUES = [
  'customer',
  'admin',
  'system',
] as const;

export type OrderTransactionActor =
  (typeof ORDER_TRANSACTION_ACTOR_VALUES)[number];

@Entity({ name: 'order_transaction_logs' })
@Index(['orderId'])
@Index(['createdAt'])
export class OrderTransactionLogEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'bigint', transformer: bigintTransformer })
  orderId!: number;

  @Column({ type: 'varchar', length: 32 })
  eventType!: OrderTransactionEvent;

  @Column({ type: 'varchar', length: 16 })
  actor!: OrderTransactionActor;

  @Column({ type: 'varchar', length: 32, nullable: true })
  fromStatus!: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  toStatus!: string | null;

  @Column({ type: 'text' })
  message!: string;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  payload!: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
