import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AccountEntity } from './account.entity';

@Entity({ name: 'account_shipping_addresses' })
@Index(['accountId'])
export class AccountShippingAddressEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  accountId!: number;

  @ManyToOne(() => AccountEntity, { onDelete: 'CASCADE' })
  account!: AccountEntity;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'varchar', nullable: true })
  address1!: string | null;

  @Column({ type: 'varchar', nullable: true, default: '' })
  address2!: string | null;

  @Column({ type: 'boolean', default: false })
  isDefault!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
