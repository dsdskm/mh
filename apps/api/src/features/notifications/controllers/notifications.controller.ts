import { BadRequestException, Controller, Get, Param, Patch } from '@nestjs/common';
import { NotificationsService } from '../services/notifications.service';

@Controller('api/backoffice/notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async getAdminNotifications() {
    const notifications = await this.notificationsService.getAdminNotifications();
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
}
