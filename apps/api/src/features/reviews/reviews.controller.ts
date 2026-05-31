import { BadRequestException, Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ReviewsService } from './reviews.service';

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
}
