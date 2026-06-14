import { Injectable } from '@nestjs/common';
import { NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InquiryCommentEntity } from '../../../database/entities/inquiry-comment.entity';
import { InquiryEntity } from '../../../database/entities/inquiry.entity';
import {
  CreateInquiryCommentInput,
  CreateInquiryInput,
  Inquiry,
} from '../../../shared/store.types';
import { FirestoreTriggerService } from '../../../shared/firestore-trigger.service';
import { NotificationsService } from '../../notifications/services/notifications.service';

@Injectable()
export class InquiriesService {
  private lastTimestamp = 0;

  private sameTickSequence = 0;

  constructor(
    @InjectRepository(InquiryEntity)
    private readonly inquiryRepository: Repository<InquiryEntity>,
    @InjectRepository(InquiryCommentEntity)
    private readonly inquiryCommentRepository: Repository<InquiryCommentEntity>,
    private readonly firestoreTrigger: FirestoreTriggerService,
    private readonly notificationsService: NotificationsService,
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

    await this.notificationsService.createNotification({
      title: '새 문의가 등록되었습니다.',
      content: `${inquiry.name} 님 문의: ${inquiry.title}`,
      type: 'inquiry',
      url: '/inquiries',
    });

    void this.firestoreTrigger.notify('inquiries');
    return this.toInquiry(inquiry);
  }

  async getAdminInquiries(): Promise<Inquiry[]> {
    const inquiries = await this.inquiryRepository.find({
      order: { createdAt: 'DESC' },
      relations: { comments: true },
    });

    return inquiries.map((inquiry) => this.toInquiry(inquiry));
  }

  async getInquiryById(id: string): Promise<Inquiry | null> {
    const inquiry = await this.inquiryRepository.findOne({
      where: { id },
      relations: { comments: true },
    });

    if (!inquiry) {
      return null;
    }

    return this.toInquiry(inquiry);
  }

  async getLatestInquiryByPhone(phone: string): Promise<Inquiry | null> {
    const inquiry = await this.inquiryRepository.findOne({
      where: { phone },
      order: { createdAt: 'DESC' },
      relations: { comments: true },
    });

    if (!inquiry) {
      return null;
    }

    return this.toInquiry(inquiry);
  }

  async createInquiryComment(input: CreateInquiryCommentInput): Promise<Inquiry> {
    const inquiry = await this.inquiryRepository.findOne({
      where: { id: input.inquiryId },
      relations: { comments: true },
    });

    if (!inquiry) {
      throw new NotFoundException('문의를 찾을 수 없습니다.');
    }

    await this.inquiryCommentRepository.save(
      this.inquiryCommentRepository.create({
        id: this.createInquiryCommentId(),
        inquiryId: input.inquiryId,
        name: input.name,
        content: input.content,
      }),
    );

    const updated = await this.inquiryRepository.findOne({
      where: { id: input.inquiryId },
      relations: { comments: true },
    });

    if (!updated) {
      throw new NotFoundException('문의를 찾을 수 없습니다.');
    }

    await this.notificationsService.createNotification({
      title: '문의 댓글이 등록되었습니다.',
      content: `${input.name}: ${input.content}`,
      type: 'inquiry-comment',
      url: '/inquiries',
    });

    void this.firestoreTrigger.notify('inquiries');
    return this.toInquiry(updated);
  }

  async deleteInquiry(id: string): Promise<boolean> {
    const result = await this.inquiryRepository.delete({ id });
    return (result.affected ?? 0) > 0;
  }

  private createInquiryId(): string {
    return this.createTimeBasedNumericId();
  }

  private createInquiryCommentId(): string {
    return this.createTimeBasedNumericId();
  }

  private createTimeBasedNumericId(): string {
    const now = Date.now();

    if (now === this.lastTimestamp) {
      this.sameTickSequence += 1;
    } else {
      this.lastTimestamp = now;
      this.sameTickSequence = 0;
    }

    return `${now}${this.sameTickSequence}`;
  }

  private toInquiry(inquiry: InquiryEntity): Inquiry {
    return {
      id: inquiry.id,
      name: inquiry.name,
      phone: inquiry.phone,
      title: inquiry.title,
      message: inquiry.message,
      createdAt: inquiry.createdAt.toISOString(),
      updatedAt: inquiry.updatedAt.toISOString(),
      comments: [...(inquiry.comments ?? [])]
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
