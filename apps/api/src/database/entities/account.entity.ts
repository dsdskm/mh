import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type AccountType = 'LOCAL' | 'KAKAO' | 'NAVER' | 'MASTER';

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
  address!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  phoneVerifiedAt!: Date | null;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
