import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReviewCommentEntity } from '../../../database/entities/review-comment.entity';
import { ReviewEntity } from '../../../database/entities/review.entity';
import {
  CreateReviewCommentInput,
  CreateReviewInput,
  Review,
} from '../../../shared/store.types';
import { FirestoreTriggerService } from '../../../shared/firestore-trigger.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { MessagesService } from '../../messages/services/messages.service';
import { ConfigService } from '../../config/services/config.service';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(ReviewEntity)
    private readonly reviewRepository: Repository<ReviewEntity>,
    @InjectRepository(ReviewCommentEntity)
    private readonly reviewCommentRepository: Repository<ReviewCommentEntity>,
    private readonly firestoreTrigger: FirestoreTriggerService,
    private readonly notificationsService: NotificationsService,
    private readonly messagesService: MessagesService,
    private readonly configService: ConfigService,
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

    await this.notificationsService.createNotification({
      title: '새 후기가 등록되었습니다.',
      content: `${review.name} 님 후기`,
      type: 'review',
      url: '/reviews',
    });

    void this.notifyAdminReviewCreatedSms();
    void this.firestoreTrigger.notify('reviews');
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

    await this.notificationsService.createNotification({
      title: '후기 댓글이 등록되었습니다.',
      content: `${input.name}: ${input.content}`,
      type: 'review-comment',
      url: '/reviews',
    });

    void this.firestoreTrigger.notify('reviews');
    return this.toReview(updated);
  }

  async deleteReview(reviewId: string): Promise<boolean> {
    const result = await this.reviewRepository.delete({ id: reviewId });
    if ((result.affected ?? 0) > 0) {
      void this.firestoreTrigger.notify('reviews');
      return true;
    }

    return false;
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
      updatedAt: review.updatedAt.toISOString(),
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

  private async notifyAdminReviewCreatedSms(): Promise<void> {
    try {
      const config = await this.configService.getStoreConfig();
      const receiver = (config.sellerPhone ?? '').replace(/\D/g, '');
      if (!/^\d{8,20}$/.test(receiver)) {
        return;
      }

      await this.messagesService.sendSms({
        receiver,
        content: '새 후기가 등록되었습니다.',
      });
    } catch (error) {
      console.warn('[reviews] 관리자 후기 알림 발송 실패', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
