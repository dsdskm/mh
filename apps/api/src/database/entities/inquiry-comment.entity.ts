import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { InquiryEntity } from './inquiry.entity';

@Entity({ name: 'inquiry_comments' })
export class InquiryCommentEntity {
  @PrimaryColumn({ type: 'varchar' })
  id!: string;

  @Index()
  @Column({ type: 'varchar' })
  inquiryId!: string;

  @ManyToOne(() => InquiryEntity, (inquiry) => inquiry.comments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'inquiryId' })
  inquiry!: InquiryEntity;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'text' })
  content!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}