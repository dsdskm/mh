import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'notices' })
export class NoticeEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar' })
  title!: string;

  @Column({ type: 'text' })
  content!: string;

  @Column({ type: 'boolean', default: false })
  isImportant!: boolean;

  @Column({ type: 'boolean', default: true })
  isPublished!: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  popupStartAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  popupEndAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}