import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { NotificationsService } from '../services/notifications.service';

type DismissNotificationBody = {
  alertId?: string;
};

@Controller('api/backoffice/notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async getAdminNotifications(@Query('limit') limitRaw?: string) {
    const limit = Number(limitRaw);
    const notifications = await this.notificationsService.getAdminNotifications(
      Number.isInteger(limit) && limit > 0 ? limit : 12,
    );
    return { notifications };
  }

  @Patch(':id/read')
  async markNotificationAsRead(@Param('id') id: string) {
    const parsedId = Number(id);
    if (Number.isNaN(parsedId)) {
      throw new BadRequestException('알림 id가 올바르지 않습니다.');
    }

    return this.notificationsService.markAsRead(parsedId);
  }

  @Post('dismiss')
  async dismissNotification(@Body() body: DismissNotificationBody) {
    const alertId = body.alertId?.trim();
    if (!alertId) {
      throw new BadRequestException('alertId가 필요합니다.');
    }

    return this.notificationsService.dismissAlert(alertId);
  }
}
