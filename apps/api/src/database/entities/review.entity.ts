import { Column, CreateDateColumn, Entity, OneToMany, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { ReviewCommentEntity } from './review-comment.entity';

@Entity({ name: 'reviews' })
export class ReviewEntity {
  @PrimaryColumn({ type: 'varchar' })
  id!: string;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'text' })
  content!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @OneToMany(() => ReviewCommentEntity, (comment) => comment.review, {
    cascade: true,
  })
  comments!: ReviewCommentEntity[];
}
