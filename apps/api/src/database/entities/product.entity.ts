import { Column, Entity, OneToMany, PrimaryColumn, UpdateDateColumn, CreateDateColumn } from 'typeorm';
import { OrderItemEntity } from './order-item.entity';

@Entity({ name: 'products' })
export class ProductEntity {
  @PrimaryColumn({ type: 'varchar' })
  id!: string;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({ type: 'int' })
  price!: number;

  @Column({ type: 'int' })
  stock!: number;

  @Column({ type: 'varchar' })
  imageUrl!: string;

  @Column({ type: 'varchar' })
  badge!: string;

  @Column({ type: 'boolean', default: true })
  active!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @OneToMany(() => OrderItemEntity, (orderItem) => orderItem.product)
  orderItems!: OrderItemEntity[];
}
