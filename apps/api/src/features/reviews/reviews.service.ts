import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReviewCommentEntity } from '../../database/entities/review-comment.entity';
import { ReviewEntity } from '../../database/entities/review.entity';
import {
  CreateReviewCommentInput,
  CreateReviewInput,
  Review,
} from '../../shared/store.types';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(ReviewEntity)
    private readonly reviewRepository: Repository<ReviewEntity>,
    @InjectRepository(ReviewCommentEntity)
    private readonly reviewCommentRepository: Repository<ReviewCommentEntity>,
  ) {}

  async getReviews(): Promise<Review[]> {
    const reviews = await this.reviewRepository.find({
      order: { createdAt: 'DESC' },
      relations: { comments: true },
    });

    return reviews.map((review) => this.toReview(review));
  }

  async createReview(input: CreateReviewInput): Promise<Review> {
    const review = await this.reviewRepository.save(
      this.reviewRepository.create({
        id: this.createReviewId(),
        name: input.name,
        content: input.content,
      }),
    );

    return this.toReview(review);
  }

  async createReviewComment(
    input: CreateReviewCommentInput,
  ): Promise<Review> {
    const review = await this.reviewRepository.findOne({
      where: { id: input.reviewId },
      relations: { comments: true },
    });

    if (!review) {
      throw new NotFoundException('후기를 찾을 수 없습니다.');
    }

    await this.reviewCommentRepository.save(
      this.reviewCommentRepository.create({
        id: this.createReviewCommentId(),
        reviewId: input.reviewId,
        name: input.name,
        content: input.content,
      }),
    );

    const updated = await this.reviewRepository.findOne({
      where: { id: input.reviewId },
      relations: { comments: true },
    });

    if (!updated) {
      throw new NotFoundException('후기를 찾을 수 없습니다.');
    }

    return this.toReview(updated);
  }

  private createReviewId(): string {
    return `REV-${Date.now().toString(36).toUpperCase()}`;
  }

  private createReviewCommentId(): string {
    return `REC-${Date.now().toString(36).toUpperCase()}`;
  }

  private toReview(review: ReviewEntity): Review {
    return {
      id: review.id,
      name: review.name,
      content: review.content,
      createdAt: review.createdAt.toISOString(),
      comments: [...(review.comments ?? [])]
        .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())
        .map((comment) => ({
        id: comment.id,
        name: comment.name,
        content: comment.content,
        createdAt: comment.createdAt.toISOString(),
      })),
    };
  }
}
