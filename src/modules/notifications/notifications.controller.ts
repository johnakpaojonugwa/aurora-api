import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('admin/notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'manager')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async getNotifications() {
    return this.notificationsService.getNotifications();
  }

  @Post('mark-read')
  async markAllRead() {
    const success = await this.notificationsService.markAllRead();
    return { success };
  }
}
