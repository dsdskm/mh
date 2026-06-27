import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { InquiriesService } from '../services/inquiries.service';

type CreateInquiryBody = {
  name?: string;
  phone?: string;
  title?: string;
  message?: string;
};

type CreateInquiryCommentBody = {
  name?: string;
  content?: string;
};

@Controller('api')
export class InquiriesController {
  constructor(private readonly inquiriesService: InquiriesService) {}

  @Get('inquiries/latest')
  getLatestInquiryByPhone(@Query('phone') phone?: string) {
    const normalizedPhone = phone?.trim();
    if (!normalizedPhone) {
      throw new BadRequestException('연락처(phone)가 필요합니다.');
    }

    return this.inquiriesService.getLatestInquiryByPhone(normalizedPhone);
  }

  @Get('inquiries/:id')
  async getInquiryById(@Param('id') id: string) {
    const inquiryId = id.trim();
    if (!inquiryId) {
      throw new BadRequestException('문의 id가 필요합니다.');
    }

    const inquiry = await this.inquiriesService.getInquiryById(inquiryId);
    if (!inquiry) {
      throw new NotFoundException('문의를 찾을 수 없습니다.');
    }

    return inquiry;
  }

  @Post('inquiries')
  createInquiry(@Body() body: CreateInquiryBody) {
    const name = body.name?.trim();
    const phone = body.phone?.trim();
    const title = body.title?.trim();
    const message = body.message?.trim();

    if (!name || !phone || !title || !message) {
      throw new BadRequestException('문의 정보를 모두 입력해주세요.');
    }

    return this.inquiriesService.createInquiry({
      name,
      phone,
      title,
      message,
    });
  }

  @Post('inquiries/:id/comments')
  createInquiryComment(
    @Param('id') id: string,
    @Body() body: CreateInquiryCommentBody,
  ) {
    const inquiryId = id.trim();
    const name = body.name?.trim();
    const content = body.content?.trim();

    if (!inquiryId || !name || !content) {
      throw new BadRequestException('댓글 작성자와 내용을 입력해주세요.');
    }

    return this.inquiriesService.createInquiryComment({
      inquiryId,
      name,
      content,
      notifyInquiryAuthorSms: false,
    });
  }

  @Delete('inquiries/:id')
  async deleteInquiry(@Param('id') id: string) {
    const inquiryId = id.trim();
    if (!inquiryId) {
      throw new BadRequestException('문의 id가 필요합니다.');
    }

    const deleted = await this.inquiriesService.deleteInquiry(inquiryId);
    if (!deleted) {
      throw new NotFoundException('문의를 찾을 수 없습니다.');
    }

    return { ok: true };
  }

  // Backoffice endpoints
  @Get('backoffice/inquiries')
  async getBackofficeInquiries() {
    return this.inquiriesService.getAdminInquiries();
  }

  @Post('backoffice/inquiries/:id/comments')
  async createBackofficeInquiryComment(
    @Param('id') inquiryId: string,
    @Body() body: CreateInquiryCommentBody,
  ) {
    const name = body.name?.trim();
    const content = body.content?.trim();

    if (!name || !content) {
      throw new BadRequestException('댓글 작성자와 내용을 입력해주세요.');
    }

    return this.inquiriesService.createInquiryComment({
      inquiryId,
      name,
      content,
      notifyInquiryAuthorSms: true,
    });
  }
}
