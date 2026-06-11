import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Index } from 'typeorm';
import { OrderEntity } from './order.entity';
import { ProductEntity } from './product.entity';

@Entity({ name: 'order_items' })
export class OrderItemEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar' })
  orderId!: string;

  @ManyToOne(() => OrderEntity, (order) => order.items, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'orderId' })
  order!: OrderEntity;

  @Index()
  @Column({ type: 'int' })
  productId!: number;

  @ManyToOne(() => ProductEntity, (product) => product.orderItems)
  @JoinColumn({ name: 'productId' })
  product!: ProductEntity;

  @Column({ type: 'varchar' })
  productName!: string;

  @Column({ type: 'int' })
  unitPrice!: number;

  @Column({ type: 'int' })
  quantity!: number;

  @Column({ type: 'int' })
  subtotal!: number;
}
