import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'app_setting_terms_history' })
@Index(['appSettingId', 'termsUpdatedAt'])
export class TermsHistoryEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  appSettingId!: number;

  @Column({ type: 'varchar' })
  documentType!: 'terms' | 'privacy';

  @Column({ type: 'text' })
  documentUrl!: string;

  @Column({ type: 'varchar' })
  termsVersion!: string;

  @Column({ type: 'timestamptz' })
  termsUpdatedAt!: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
