import { Column, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { StoreRecipe, StoreStoryImage } from '../../shared/store.types';

@Entity({ name: 'app_settings' })
export class AppSettingEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar' })
  shopName!: string;

  @Column({ type: 'varchar' })
  sellerName!: string;

  @Column({ type: 'varchar' })
  sellerPhone!: string;

  @Column({ type: 'varchar' })
  origin!: string;

  @Column({ type: 'varchar' })
  bankName!: string;

  @Column({ type: 'varchar' })
  accountNumber!: string;

  @Column({ type: 'varchar' })
  accountHolder!: string;

  @Column({ type: 'varchar' })
  transferNote!: string;

  @Column({ type: 'text' })
  detailDescription!: string;

  @Column({ type: 'jsonb' })
  storyImages!: StoreStoryImage[];

  @Column({ type: 'varchar' })
  videoUrl!: string;

  @Column({ type: 'jsonb' })
  recipes!: StoreRecipe[];

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
