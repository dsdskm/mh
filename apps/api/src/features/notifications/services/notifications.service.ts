import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Like, Repository } from 'typeorm';
import { NotificationEntity, NotificationType } from '../../../database/entities/notification.entity';
import { AdminNotification } from '../../../shared/store.types';

type CreateNotificationInput = {
  title: string;
  content: string;
  type: NotificationType;
  url: string;
};

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(NotificationEntity)
    private readonly notificationRepository: Repository<NotificationEntity>,
  ) {}

  async createNotification(input: CreateNotificationInput): Promise<AdminNotification> {
    const saved = await this.notificationRepository.save(
      this.notificationRepository.create({
        title: input.title,
        content: input.content,
        type: input.type,
        url: input.url,
      }),
    );

    return this.toAdminNotification(saved);
  }

  async getAdminNotifications(limit = 12): Promise<AdminNotification[]> {
    const notifications = await this.notificationRepository.find({
      order: { createdAt: 'DESC' },
      take: limit,
    });

    return notifications.map((item) => this.toAdminNotification(item));
  }

  async markAsRead(id: number): Promise<{ ok: true; removed: boolean }> {
    const notification = await this.notificationRepository.findOne({
      where: { id },
    });

    if (!notification) {
      throw new NotFoundException('알림을 찾을 수 없습니다.');
    }

    notification.isRead = true;
    await this.notificationRepository.save(notification);

    if (notification.type !== 'order') {
      await this.notificationRepository.delete({ id: notification.id });
      return { ok: true, removed: true };
    }

    return { ok: true, removed: false };
  }

  async deleteOrderNotifications(orderId: number): Promise<void> {
    await this.notificationRepository.delete({
      type: 'order',
      url: '/orders',
      content: Like(`%주문 ${orderId}%`),
    });
  }

  private toAdminNotification(notification: NotificationEntity): AdminNotification {
    return {
      id: notification.id,
      title: notification.title,
      content: notification.content,
      createdAt: notification.createdAt.toISOString(),
      type: notification.type,
      isRead: notification.isRead,
      url: notification.url,
    };
  }
}
