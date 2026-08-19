import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { OrderStatus, PaymentStatus, Prisma } from '@prisma/client';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { RefundOrderDto } from './dto/refund-order.dto';
import { generateCsv } from '../../common/utils/csv.util';

@Injectable()
export class OrdersService {
  constructor(private prisma: PrismaService) {}

  async adminFindAll(query: {
    page?: number;
    limit?: number;
    search?: string;
    status?: OrderStatus;
    paymentStatus?: PaymentStatus;
    startDate?: string;
    endDate?: string;
    sortBy?: 'createdAt' | 'total' | 'status';
    sortOrder?: 'asc' | 'desc';
  }) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.OrderWhereInput = {};

    if (query.status) {
      where.status = query.status;
    }

    if (query.paymentStatus) {
      where.paymentStatus = query.paymentStatus;
    }

    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) {
        where.createdAt.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        where.createdAt.lte = new Date(query.endDate);
      }
    }

    if (query.search) {
      where.OR = [
        { id: query.search },
        { orderNumber: { contains: query.search, mode: 'insensitive' } },
        {
          user: {
            OR: [
              { firstName: { contains: query.search, mode: 'insensitive' } },
              { lastName: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
            ],
          },
        },
      ];
    }

    const sortBy = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder || 'desc';

    const [total, data] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [sortBy]: sortOrder,
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          items: true,
        },
      }),
    ]);

    const formattedData = data.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      customer: {
        id: order.user.id,
        name: `${order.user.firstName || ''} ${order.user.lastName || ''}`.trim() || order.user.email,
        email: order.user.email,
      },
      total: Number(order.total),
      status: order.status,
      paymentStatus: order.paymentStatus,
      createdAt: order.createdAt,
      items: order.items.map((item) => ({
        id: item.id,
        productName: item.productName,
        productSku: item.productSku,
        quantity: item.quantity,
        price: Number(item.price),
        total: Number(item.total),
      })),
    }));

    return {
      data: formattedData,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async adminFindOne(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        items: true,
        timeline: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      customer: {
        id: order.user.id,
        name: `${order.user.firstName || ''} ${order.user.lastName || ''}`.trim() || order.user.email,
        email: order.user.email,
      },
      shippingAddress: order.shippingAddress,
      billingAddress: order.billingAddress,
      subtotal: Number(order.subtotal),
      tax: Number(order.tax),
      taxBreakdown: order.taxBreakdown,
      shipping: Number(order.shipping),
      discount: Number(order.discount),
      total: Number(order.total),
      currency: order.currency,
      status: order.status,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      paymentIntentId: order.paymentIntentId,
      transactionId: order.transactionId,
      placedAt: order.placedAt,
      paidAt: order.paidAt,
      shippedAt: order.shippedAt,
      deliveredAt: order.deliveredAt,
      cancelledAt: order.cancelledAt,
      refundedAt: order.refundedAt,
      items: order.items.map((i) => ({
        id: i.id,
        productId: i.productId,
        productName: i.productName,
        productSku: i.productSku,
        variation: i.variation,
        quantity: i.quantity,
        price: Number(i.price),
        total: Number(i.total),
      })),
      timeline: order.timeline,
      statusHistory: order.timeline.map((t) => ({
        status: t.status,
        description: t.description,
        timestamp: t.createdAt,
      })),
    };
  }

  async adminUpdateStatus(id: string, dto: UpdateOrderStatusDto) {
    const order = await this.prisma.order.findUnique({
      where: { id },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const data: Prisma.OrderUpdateInput = {
      status: dto.status,
    };

    if (dto.status === OrderStatus.delivered) {
      data.deliveredAt = new Date();
    } else if (dto.status === OrderStatus.shipping) {
      data.shippedAt = new Date();
    } else if (dto.status === OrderStatus.cancelled) {
      data.cancelledAt = new Date();
    }

    return this.prisma.$transaction(async (tx) => {
      const updatedOrder = await tx.order.update({
        where: { id },
        data,
      });

      await tx.orderTimeline.create({
        data: {
          orderId: id,
          status: dto.status,
          description: dto.note || `Order status updated to ${dto.status}`,
        },
      });

      return updatedOrder;
    });
  }

  async adminRefund(id: string, dto: RefundOrderDto) {
    const order = await this.prisma.order.findUnique({
      where: { id },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.paymentStatus === PaymentStatus.refunded) {
      throw new BadRequestException('Order has already been refunded');
    }

    const refundAmount = dto.amount || Number(order.total);

    return this.prisma.$transaction(async (tx) => {
      const updatedOrder = await tx.order.update({
        where: { id },
        data: {
          paymentStatus: PaymentStatus.refunded,
          status: OrderStatus.refunded,
          refundedAt: new Date(),
        },
      });

      await tx.orderTimeline.create({
        data: {
          orderId: id,
          status: OrderStatus.refunded,
          description: `Refund of $${refundAmount.toFixed(2)} processed. Reason: ${dto.reason}`,
        },
      });

      return updatedOrder;
    });
  }

  async adminExportCsv(query: {
    status?: OrderStatus;
    startDate?: string;
    endDate?: string;
  }) {
    const where: Prisma.OrderWhereInput = {};

    if (query.status) {
      where.status = query.status;
    }

    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) {
        where.createdAt.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        where.createdAt.lte = new Date(query.endDate);
      }
    }

    const orders = await this.prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    const headers = [
      'Order ID',
      'Order Number',
      'Customer Name',
      'Customer Email',
      'Total Amount',
      'Order Status',
      'Payment Status',
      'Payment Method',
      'Transaction ID',
      'Date Placed',
    ];

    const rows = orders.map((o) => {
      const name = `${o.user.firstName || ''} ${o.user.lastName || ''}`.trim() || o.user.email;
      return [
        o.id,
        o.orderNumber,
        name,
        o.user.email,
        Number(o.total),
        o.status,
        o.paymentStatus,
        o.paymentMethod,
        o.transactionId || 'N/A',
        o.createdAt.toISOString(),
      ];
    });

    return generateCsv(headers, rows);
  }

  async adminBulkStatus(dto: { orderIds: string[]; status: OrderStatus }) {
    const { orderIds, status } = dto;
    return this.prisma.$transaction(async (tx) => {
      await tx.order.updateMany({
        where: { id: { in: orderIds } },
        data: {
          status,
          deliveredAt: status === OrderStatus.delivered ? new Date() : undefined,
          shippedAt: status === OrderStatus.shipping ? new Date() : undefined,
        },
      });

      for (const orderId of orderIds) {
        await tx.orderTimeline.create({
          data: {
            orderId,
            status,
            description: `Bulk update: Order status updated to ${status}`,
          },
        });
      }

      return { success: true, count: orderIds.length };
    });
  }
}
