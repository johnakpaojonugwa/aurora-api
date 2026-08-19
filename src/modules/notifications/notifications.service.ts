import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { OrderStatus, PaymentStatus } from '@prisma/client';

export interface NotificationItem {
  id: string;
  type: 'STOCK' | 'ORDER' | 'PAYMENT';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}

@Injectable()
export class NotificationsService {
  private readIds = new Set<string>();

  constructor(private readonly prisma: PrismaService) {}

  async getNotifications(): Promise<NotificationItem[]> {
    const notifications: NotificationItem[] = [];

    try {
      // 1. Fetch low stock items
      const lowStockItems = await this.prisma.inventory.findMany({
        where: {
          quantity: { lte: 5 },
        },
        include: {
          product: true,
        },
        take: 10,
      });

      for (const item of lowStockItems) {
        if (item.product) {
          const id = `stock-${item.productId}-${item.quantity}`;
          notifications.push({
            id,
            type: 'STOCK',
            title: 'Low Stock Alert',
            message: `${item.product.name} is down to ${item.quantity} items.`,
            timestamp: item.updatedAt.toISOString(),
            read: this.readIds.has(id),
          });
        }
      }
    } catch (e) {
      console.error('Error fetching low stock alerts', e);
    }

    try {
      // 2. Fetch recent orders
      const recentOrders = await this.prisma.order.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          user: true,
        },
      });

      for (const order of recentOrders) {
        const orderId = `order-${order.id}`;
        notifications.push({
          id: orderId,
          type: 'ORDER',
          title: 'New Order Received',
          message: `Order #${order.orderNumber} worth ₦${Number(order.total).toLocaleString()} has been placed.`,
          timestamp: order.createdAt.toISOString(),
          read: this.readIds.has(orderId),
        });

        if (order.status === OrderStatus.failed || order.paymentStatus === PaymentStatus.failed) {
          const payId = `pay-fail-${order.id}`;
          notifications.push({
            id: payId,
            type: 'PAYMENT',
            title: 'Payment Failed',
            message: `Transaction for order #${order.orderNumber} failed or was declined for ${order.user?.email || 'customer'}.`,
            timestamp: order.updatedAt.toISOString(),
            read: this.readIds.has(payId),
          });
        }
      }
    } catch (e) {
      console.error('Error fetching recent orders', e);
    }

    // Sort by timestamp desc
    return notifications.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  async markAllRead(): Promise<boolean> {
    try {
      const all = await this.getNotifications();
      for (const item of all) {
        this.readIds.add(item.id);
      }
      return true;
    } catch (e) {
      console.error('Error marking notifications as read', e);
      return false;
    }
  }
}
