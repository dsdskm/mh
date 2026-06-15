import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type AccountType = 'NORMAL' | 'KAKAO' | 'NAVER' | 'MASTER';
export type AccountStatus = 'active' | 'deactive' | 'withdraw';

@Entity({ name: 'accounts' })
@Index(['type', 'providerUserId'], { unique: true })
@Index(['userId'], { unique: true })
@Index(['phone'], { unique: true })
export class AccountEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', nullable: true })
  userId!: string | null;

  @Column({ type: 'varchar' })
  type!: AccountType;

  @Column({ type: 'varchar', nullable: true })
  username!: string | null;

  @Column({ type: 'varchar', nullable: true })
  password!: string | null;

  @Column({ type: 'varchar', nullable: true })
  providerUserId!: string | null;

  @Column({ type: 'varchar', nullable: true })
  email!: string | null;

  @Column({ type: 'varchar', nullable: true })
  displayName!: string | null;

  @Column({ type: 'varchar', nullable: true })
  phone!: string | null;

  @Column({ type: 'varchar', nullable: true })
  address1!: string | null;

  @Column({ type: 'varchar', nullable: true })
  address2!: string | null;

  @Column({ type: 'varchar', default: 'active' })
  status!: AccountStatus;

  @Column({ type: 'varchar', nullable: true })
  statusReason!: string | null;

  @Column({ type: 'boolean', default: false })
  termsAgreed!: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  termsAgreedAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  phoneVerifiedAt!: Date | null;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  // 적립금(마일리지) 잔액. 원장은 mileage_transactions 에 기록
  @Column({ type: 'int', default: 0 })
  mileageBalance!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
