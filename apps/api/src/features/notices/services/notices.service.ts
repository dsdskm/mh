import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NoticeEntity } from '../../../database/entities/notice.entity';
import {
  CreateNoticeInput,
  Notice,
  UpdateNoticeInput,
} from '../../../shared/store.types';

@Injectable()
export class NoticesService {
  constructor(
    @InjectRepository(NoticeEntity)
    private readonly noticeRepository: Repository<NoticeEntity>,
  ) {}

  async getPublishedNotices(): Promise<Notice[]> {
    const notices = await this.noticeRepository.find({
      where: { isPublished: true },
      order: {
        isImportant: 'DESC',
        createdAt: 'DESC',
      },
    });

    return notices.map((item) => this.toNotice(item));
  }

  async getPopupNotices(): Promise<Notice[]> {
    const now = new Date();
    const notices = await this.noticeRepository
      .createQueryBuilder('notice')
      .where('notice.isPublished = true')
      .andWhere('notice.isImportant = true')
      .andWhere('notice.popupStartAt IS NOT NULL')
      .andWhere('notice.popupEndAt IS NOT NULL')
      .andWhere('notice.popupStartAt <= :now', {
        now,
      })
      .andWhere('notice.popupEndAt >= :now', {
        now,
      })
      .orderBy('notice.popupStartAt', 'DESC')
      .addOrderBy('notice.createdAt', 'DESC')
      .getMany();

    return notices.map((item) => this.toNotice(item));
  }

  async getAdminNotices(): Promise<Notice[]> {
    const notices = await this.noticeRepository.find({
      order: {
        createdAt: 'DESC',
      },
    });

    return notices.map((item) => this.toNotice(item));
  }

  async createNotice(input: CreateNoticeInput): Promise<Notice> {
    const notice = await this.noticeRepository.save(
      this.noticeRepository.create({
        title: input.title,
        content: input.content,
        isImportant: input.isImportant ?? false,
        isPublished: input.isPublished ?? true,
        popupStartAt: this.parseDate(input.popupStartAt),
        popupEndAt: this.parseDate(input.popupEndAt),
      }),
    );

    return this.toNotice(notice);
  }

  async updateNotice(id: number, input: UpdateNoticeInput): Promise<Notice> {
    const notice = await this.noticeRepository.findOne({ where: { id } });
    if (!notice) {
      throw new NotFoundException('수정할 공지사항을 찾을 수 없습니다.');
    }

    const updated = await this.noticeRepository.save({
      ...notice,
      title: input.title ?? notice.title,
      content: input.content ?? notice.content,
      isImportant: input.isImportant ?? notice.isImportant,
      isPublished: input.isPublished ?? notice.isPublished,
      popupStartAt:
        input.popupStartAt === undefined
          ? notice.popupStartAt
          : this.parseDate(input.popupStartAt),
      popupEndAt:
        input.popupEndAt === undefined
          ? notice.popupEndAt
          : this.parseDate(input.popupEndAt),
    });

    return this.toNotice(updated);
  }

  async deleteNotice(id: number): Promise<boolean> {
    const result = await this.noticeRepository.delete({ id });
    return (result.affected ?? 0) > 0;
  }

  private parseDate(value?: string | null): Date | null {
    if (!value) {
      return null;
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }

    return parsed;
  }

  private toNotice(notice: NoticeEntity): Notice {
    return {
      id: notice.id,
      title: notice.title,
      content: notice.content,
      isImportant: notice.isImportant,
      isPublished: notice.isPublished,
      popupStartAt: notice.popupStartAt?.toISOString() ?? null,
      popupEndAt: notice.popupEndAt?.toISOString() ?? null,
      createdAt: notice.createdAt.toISOString(),
      updatedAt: notice.updatedAt.toISOString(),
    };
  }
}