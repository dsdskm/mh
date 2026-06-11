import { Column, Entity, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn, CreateDateColumn } from 'typeorm';
import { OrderItemEntity } from './order-item.entity';

@Entity({ name: 'products' })
export class ProductEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({ type: 'int' })
  price!: number;

  @Column({ type: 'int' })
  stock!: number;

  @Column({ type: 'int', default: 0 })
  totalQuantity!: number;

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
