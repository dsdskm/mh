import { BadRequestException, Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post } from '@nestjs/common';
import { NoticesService } from '../services/notices.service';

type NoticeBody = {
  title?: string;
  content?: string;
  isImportant?: boolean;
  isPublished?: boolean;
  popupStartAt?: string | null;
  popupEndAt?: string | null;
};

@Controller('api')
export class NoticesController {
  constructor(private readonly noticesService: NoticesService) {}

  @Get('notices')
  getNotices() {
    return this.noticesService.getPublishedNotices();
  }

  @Get('notices/popup')
  getPopupNotices() {
    return this.noticesService.getPopupNotices();
  }

  // Backoffice endpoints
  @Get('backoffice/notices')
  async getBackofficeNotices() {
    return this.noticesService.getAdminNotices();
  }

  @Post('backoffice/notices')
  async createNotice(@Body() body: NoticeBody) {
    const title = body.title?.trim();
    const content = body.content?.trim();

    if (!title || !content) {
      throw new BadRequestException('제목과 내용을 입력해주세요.');
    }

    this.validateNoticePopupWindow(body.popupStartAt, body.popupEndAt);

    return this.noticesService.createNotice({
      title,
      content,
      isImportant: body.isImportant,
      isPublished: body.isPublished,
      popupStartAt: body.popupStartAt,
      popupEndAt: body.popupEndAt,
    });
  }

  @Patch('backoffice/notices/:id')
  async updateNotice(@Param('id') id: string, @Body() body: NoticeBody) {
    const noticeId = Number(id);
    if (Number.isNaN(noticeId)) {
      throw new BadRequestException('공지사항 id가 올바르지 않습니다.');
    }

    if (body.title !== undefined && !body.title.trim()) {
      throw new BadRequestException('제목은 빈값일 수 없습니다.');
    }

    if (body.content !== undefined && !body.content.trim()) {
      throw new BadRequestException('내용은 빈값일 수 없습니다.');
    }

    this.validateNoticePopupWindow(body.popupStartAt, body.popupEndAt);

    return this.noticesService.updateNotice(noticeId, {
      title: body.title?.trim(),
      content: body.content?.trim(),
      isImportant: body.isImportant,
      isPublished: body.isPublished,
      popupStartAt: body.popupStartAt,
      popupEndAt: body.popupEndAt,
    });
  }

  @Delete('backoffice/notices/:id')
  async deleteNotice(@Param('id') id: string) {
    const noticeId = Number(id);
    if (Number.isNaN(noticeId)) {
      throw new BadRequestException('공지사항 id가 올바르지 않습니다.');
    }

    const deleted = await this.noticesService.deleteNotice(noticeId);
    if (!deleted) {
      throw new NotFoundException('공지사항을 찾을 수 없습니다.');
    }

    return { ok: true };
  }

  private validateNoticePopupWindow(popupStartAt?: string | null, popupEndAt?: string | null) {
    if (popupStartAt || popupEndAt) {
      const start = popupStartAt ? new Date(popupStartAt) : null;
      const end = popupEndAt ? new Date(popupEndAt) : null;

      if (start && end && start >= end) {
        throw new BadRequestException('팝업 시작일시는 종료일시보다 빨라야 합니다.');
      }
    }
  }
}