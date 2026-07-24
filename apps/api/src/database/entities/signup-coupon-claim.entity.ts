import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'signup_coupon_claims' })
@Index(['phone'])
@Index(['providerUserId'])
@Index(['accountId'], { unique: true })
export class SignupCouponClaimEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int', nullable: true })
  accountId!: number | null;

  @Column({ type: 'varchar', nullable: true })
  phone!: string | null;

  @Column({ type: 'varchar', nullable: true })
  providerUserId!: string | null;

  @Column({ type: 'varchar' })
  templateName!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  claimedAt!: Date;
}
