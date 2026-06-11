import { Column, CreateDateColumn, Entity, OneToMany, PrimaryColumn } from 'typeorm';
import { OrderItemEntity } from './order-item.entity';

@Entity({ name: 'orders' })
export class OrderEntity {
  @PrimaryColumn({ type: 'varchar' })
  id!: string;

  @Column({ type: 'varchar' })
  customerName!: string;

  @Column({ type: 'varchar' })
  phone!: string;

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

  @Column({ type: 'int' })
  totalAmount!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @OneToMany(() => OrderItemEntity, (orderItem) => orderItem.order, {
    cascade: true,
  })
  items!: OrderItemEntity[];
}
