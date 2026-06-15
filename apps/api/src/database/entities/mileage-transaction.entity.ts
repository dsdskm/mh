import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { bigintTransformer } from '../column-transformers';
import type { MileageTxType } from '@repo/shared-types/mileage';

// 적립금 변동 원장 (한 행 = 한 번의 적립/사용/지급/차감/복원)
@Entity({ name: 'mileage_transactions' })
export class MileageTransactionEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index()
  @Column({ type: 'int' })
  accountId!: number;

  // 부호 있는 변동량 (+적립/지급/복원, -사용/차감/회수)
  @Column({ type: 'int' })
  amount!: number;

  @Column({ type: 'varchar' })
  type!: MileageTxType;

  @Column({ type: 'bigint', nullable: true, transformer: bigintTransformer })
  orderId!: number | null;

  @Column({ type: 'varchar', nullable: true })
  reason!: string | null;

  @Column({ type: 'int' })
  balanceAfter!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
