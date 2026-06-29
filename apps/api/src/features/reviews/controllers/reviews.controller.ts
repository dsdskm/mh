import { BadRequestException, Body, Controller, Delete, Get, NotFoundException, Param, Post } from '@nestjs/common';
import { ReviewsService } from '../services/reviews.service';

type CreateReviewBody = {
  name?: string;
  content?: string;
};

type CreateReviewCommentBody = {
  name?: string;
  content?: string;
};

@Controller('api')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get('reviews')
  getReviews() {
    return this.reviewsService.getReviews();
  }

  @Post('reviews')
  createReview(@Body() body: CreateReviewBody) {
    const name = body.name?.trim();
    const content = body.content?.trim();

    if (!name || !content) {
      throw new BadRequestException('후기 작성자와 내용을 입력해주세요.');
    }

    return this.reviewsService.createReview({
      name,
      content,
    });
  }

  @Post('reviews/:id/comments')
  createReviewComment(
    @Param('id') reviewId: string,
    @Body() body: CreateReviewCommentBody,
  ) {
    const name = body.name?.trim();
    const content = body.content?.trim();

    if (!name || !content) {
      throw new BadRequestException('댓글 작성자와 내용을 입력해주세요.');
    }

    return this.reviewsService.createReviewComment({
      reviewId,
      name,
      content,
    });
  }

  // Backoffice endpoints
  @Get('backoffice/reviews')
  async getBackofficeReviews() {
    return this.reviewsService.getReviews();
  }

  @Post('backoffice/reviews/:id/comments')
  async createBackofficeReviewComment(
    @Param('id') reviewId: string,
    @Body() body: CreateReviewCommentBody,
  ) {
    const name = body.name?.trim();
    const content = body.content?.trim();

    if (!name || !content) {
      throw new BadRequestException('댓글 작성자와 내용을 입력해주세요.');
    }

    return this.reviewsService.createReviewComment({
      reviewId,
      name,
      content,
    });
  }

  @Delete('backoffice/reviews/:id')
  async deleteBackofficeReview(@Param('id') reviewId: string) {
    const deleted = await this.reviewsService.deleteReview(reviewId);
    if (!deleted) {
      throw new NotFoundException('후기를 찾을 수 없습니다.');
    }

    return { ok: true };
  }
}
