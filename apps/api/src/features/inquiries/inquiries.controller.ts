import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { InquiriesService } from './inquiries.service';

type CreateInquiryBody = {
  name?: string;
  phone?: string;
  title?: string;
  message?: string;
};

@Controller('api')
export class InquiriesController {
  constructor(private readonly inquiriesService: InquiriesService) {}

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
}
