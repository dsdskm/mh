import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn, Index } from 'typeorm';
import { ReviewEntity } from './review.entity';

@Entity({ name: 'review_comments' })
export class ReviewCommentEntity {
  @PrimaryColumn({ type: 'varchar' })
  id!: string;

  @Index()
  @Column({ type: 'varchar' })
  reviewId!: string;

  @ManyToOne(() => ReviewEntity, (review) => review.comments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'reviewId' })
  review!: ReviewEntity;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'text' })
  content!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
