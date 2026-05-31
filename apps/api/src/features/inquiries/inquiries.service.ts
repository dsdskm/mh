import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InquiryEntity } from '../../database/entities/inquiry.entity';
import { CreateInquiryInput, Inquiry } from '../../shared/store.types';

@Injectable()
export class InquiriesService {
  constructor(
    @InjectRepository(InquiryEntity)
    private readonly inquiryRepository: Repository<InquiryEntity>,
  ) {}

  async createInquiry(input: CreateInquiryInput): Promise<Inquiry> {
    const inquiry = await this.inquiryRepository.save(
      this.inquiryRepository.create({
        id: this.createInquiryId(),
        name: input.name,
        phone: input.phone,
        title: input.title,
        message: input.message,
      }),
    );

    return this.toInquiry(inquiry);
  }

  async getAdminInquiries(): Promise<Inquiry[]> {
    const inquiries = await this.inquiryRepository.find({
      order: { createdAt: 'DESC' },
    });

    return inquiries.map((inquiry) => this.toInquiry(inquiry));
  }

  private createInquiryId(): string {
    return `INQ-${Date.now().toString(36).toUpperCase()}`;
  }

  private toInquiry(inquiry: InquiryEntity): Inquiry {
    return {
      id: inquiry.id,
      name: inquiry.name,
      phone: inquiry.phone,
      title: inquiry.title,
      message: inquiry.message,
      createdAt: inquiry.createdAt.toISOString(),
    };
  }
}
