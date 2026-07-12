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
import { MessagesService } from '../../messages/services/messages.service';
import { ConfigService } from '../../config/services/config.service';

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
    private readonly messagesService: MessagesService,
    private readonly configService: ConfigService,
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

    void this.notifyAdminInquiryCreatedSms();
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

    if (input.notifyInquiryAuthorSms) {
      void this.notifyInquiryAuthorCommented(inquiry.phone);
    }

    void this.firestoreTrigger.notify('inquiries');
    return this.toInquiry(updated);
  }

  async deleteInquiry(id: string): Promise<boolean> {
    const result = await this.inquiryRepository.delete({ id });
    const deleted = (result.affected ?? 0) > 0;
    if (deleted) {
      void this.firestoreTrigger.notify('inquiries');
    }

    return deleted;
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

  private async notifyInquiryAuthorCommented(phoneRaw: string): Promise<void> {
    const receiver = (phoneRaw ?? '').replace(/\D/g, '');
    if (!/^\d{8,20}$/.test(receiver)) {
      return;
    }

    try {
      await this.messagesService.sendSms({
        receiver,
        content: '문의글에 댓글이 등록되었습니다.',
      });
    } catch (error) {
      console.warn('[inquiries] 댓글 등록 안내 알림 발송 실패', {
        receiver,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async notifyAdminInquiryCreatedSms(): Promise<void> {
    try {
      const config = await this.configService.getStoreConfig();
      const receiver = (config.sellerPhone ?? '').replace(/\D/g, '');
      if (!/^\d{8,20}$/.test(receiver)) {
        return;
      }

      await this.messagesService.sendSms({
        receiver,
        content: '새 문의가 등록되었습니다.',
      });
    } catch (error) {
      console.warn('[inquiries] 관리자 문의 알림 발송 실패', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
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
