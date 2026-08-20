import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { OrderStatus, PaymentStatus, Prisma, Order } from '@prisma/client';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { RefundOrderDto } from './dto/refund-order.dto';
import { generateCsv } from '../../common/utils/csv.util';
import { ConfigService } from '@nestjs/config';
import { CheckoutDto } from './dto/checkout.dto';
import Stripe from 'stripe';

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

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
        name:
          `${order.user.firstName || ''} ${order.user.lastName || ''}`.trim() ||
          order.user.email,
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
        name:
          `${order.user.firstName || ''} ${order.user.lastName || ''}`.trim() ||
          order.user.email,
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
      const name =
        `${o.user.firstName || ''} ${o.user.lastName || ''}`.trim() ||
        o.user.email;
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
          deliveredAt:
            status === OrderStatus.delivered ? new Date() : undefined,
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

  async processCheckout(userId: string, dto: CheckoutDto) {
    const { shippingAddress, paymentMethodId, idempotencyKey } = dto;

    // 1. Idempotency Check
    const existingOrder = await this.prisma.order.findUnique({
      where: { idempotencyKey },
    });

    if (existingOrder) {
      return this.formatOrderResponse(existingOrder);
    }

    // 2. Fetch Cart
    const cart = await this.prisma.cart.findUnique({
      where: { userId },
      include: {
        items: {
          include: {
            product: {
              include: {
                inventory: true,
                variations: true,
              },
            },
          },
        },
      },
    });

    if (!cart || cart.items.length === 0) {
      throw new BadRequestException('Shopping cart is empty');
    }

    // 3. Verify Stock & Prepare updates
    const stockUpdates: {
      id: string;
      type: 'variation' | 'inventory';
      quantity: number;
    }[] = [];

    for (const item of cart.items) {
      if (item.variationId) {
        const variation = item.product.variations.find(
          (v) => v.id === item.variationId,
        );
        if (!variation || variation.stock < item.quantity) {
          throw new ConflictException(
            `Product variation ${variation?.name || ''} is out of stock`,
          );
        }
        stockUpdates.push({
          id: item.variationId,
          type: 'variation',
          quantity: item.quantity,
        });
      } else {
        const stock = item.product.inventory?.quantity || 0;
        if (stock < item.quantity) {
          throw new ConflictException(
            `Product ${item.product.name} is out of stock`,
          );
        }
        stockUpdates.push({
          id: item.product.inventory!.id,
          type: 'inventory',
          quantity: item.quantity,
        });
      }
    }

    // 4. Fetch settings for Tax & Shipping
    let taxRate = 0.1; // Default 10%
    let freeShippingThreshold = 100.0;
    const baseShippingFee = 10.0;

    const settings = await this.prisma.systemSettings.findFirst();
    if (settings) {
      const rates = settings.taxRates as { rate?: number }[];
      if (rates && rates.length > 0) {
        taxRate = Number(rates[0].rate) || 0.1;
      }
      freeShippingThreshold = settings.freeShippingThreshold
        ? Number(settings.freeShippingThreshold)
        : 100.0;
    }

    // Calculate financials
    const subtotal = cart.items.reduce(
      (sum, item) => sum + Number(item.product.price) * item.quantity,
      0,
    );
    const tax = subtotal * taxRate;
    const shipping = subtotal >= freeShippingThreshold ? 0 : baseShippingFee;
    const discount = 0;
    const total = subtotal + tax + shipping - discount;

    const orderNumber = `ORD-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    // 5. Database Transaction (Create Order, update stock, clear cart)
    let orderId = '';
    await this.prisma.$transaction(async (tx) => {
      // A. Decrement stock
      for (const update of stockUpdates) {
        if (update.type === 'variation') {
          await tx.productVariation.update({
            where: { id: update.id },
            data: { stock: { decrement: update.quantity } },
          });
        } else {
          await tx.inventory.update({
            where: { id: update.id },
            data: { quantity: { decrement: update.quantity } },
          });
        }
      }

      // B. Create Order
      const order = await tx.order.create({
        data: {
          orderNumber,
          userId,
          status: OrderStatus.pending,
          paymentStatus: PaymentStatus.pending,
          paymentMethod: 'stripe',
          shippingAddress: {
            name: shippingAddress.name,
            address1: shippingAddress.address,
            address2: '',
            city: shippingAddress.city,
            state: shippingAddress.state || '',
            zipCode: shippingAddress.zipCode || '',
            country: shippingAddress.country,
            phone: shippingAddress.phone || '',
          },
          subtotal: new Prisma.Decimal(subtotal),
          tax: new Prisma.Decimal(tax),
          shipping: new Prisma.Decimal(shipping),
          discount: new Prisma.Decimal(discount),
          total: new Prisma.Decimal(total),
          idempotencyKey,
        },
      });

      orderId = order.id;

      // C. Create OrderItems
      for (const item of cart.items) {
        let variationJson: Prisma.InputJsonValue | null = null;
        if (item.variationId) {
          const v = item.product.variations.find(
            (varItem) => varItem.id === item.variationId,
          );
          if (v) {
            variationJson = {
              id: v.id,
              name: v.name,
              sku: v.sku,
              attributes: v.attributes as Prisma.InputJsonValue,
            };
          }
        }

        await tx.orderItem.create({
          data: {
            orderId: order.id,
            productId: item.productId,
            productName: item.product.name,
            productSku: item.product.sku,
            ...(variationJson ? { variation: variationJson } : {}),
            quantity: item.quantity,
            price: item.product.price,
            total: new Prisma.Decimal(
              Number(item.product.price) * item.quantity,
            ),
          },
        });
      }

      // D. Create Timeline
      await tx.orderTimeline.create({
        data: {
          orderId: order.id,
          status: OrderStatus.pending,
          description: 'Order placed, awaiting payment confirmation',
        },
      });

      // E. Clear Cart Items
      await tx.cartItem.deleteMany({
        where: { cartId: cart.id },
      });

      return order;
    });

    // 6. Attempt Charge via Stripe
    const stripeKey = this.configService.get<string>('stripeSecretKey');
    let paymentSucceeded = false;
    let transactionId = '';

    if (stripeKey && stripeKey !== 'sk_test_...') {
      try {
        const stripeClient = new Stripe(stripeKey, {
          apiVersion: '2026-07-29.dahlia',
        });
        const charge = await stripeClient.paymentIntents.create({
          amount: Math.round(total * 100),
          currency: 'usd',
          payment_method: paymentMethodId,
          confirm: true,
        });

        if (charge.status === 'succeeded') {
          paymentSucceeded = true;
          transactionId = charge.id;
        }
      } catch (err) {
        console.error('Payment processing failed:', err);
      }
    } else {
      paymentSucceeded = true;
      transactionId = `ch_mock_${Math.random().toString(36).substring(2, 15)}`;
    }

    // 7. Update order based on payment result
    if (paymentSucceeded) {
      const updated = await this.prisma.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.paid,
          paymentStatus: PaymentStatus.succeeded,
          transactionId,
          paidAt: new Date(),
        },
      });

      await this.prisma.orderTimeline.create({
        data: {
          orderId,
          status: OrderStatus.paid,
          description: `Payment successful. Transaction ID: ${transactionId}`,
        },
      });

      return this.formatOrderResponse(updated);
    } else {
      await this.prisma.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.failed,
          paymentStatus: PaymentStatus.failed,
        },
      });

      await this.prisma.orderTimeline.create({
        data: {
          orderId,
          status: OrderStatus.failed,
          description: 'Payment failed, checkout transaction incomplete',
        },
      });

      throw new BadRequestException(`Payment failed for order ${orderNumber}`);
    }
  }

  private formatOrderResponse(order: Order) {
    return {
      id: order.id,
      total: Number(order.total),
      status: order.status,
      date: order.createdAt,
    };
  }

  /**
   * Retrieves the complete order history for a specific customer.
   * Maps Prisma database structures to match the frontend shape including product images.
   * 
   * @param userId The database ID of the user whose orders are retrieved.
   * @returns Array of orders formatted for the client dashboard.
   */
  async findUserOrders(userId: string) {
    const customerOrders = await this.prisma.order.findMany({
      where: { userId },
      include: {
        items: {
          include: {
            product: {
              include: {
                images: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return customerOrders.map((order) => {
      const shippingDetails = order.shippingAddress as any;
      return {
        id: order.id,
        date: order.createdAt,
        status: order.status,
        total: Number(order.total),
        firstName: shippingDetails?.name?.split(' ')[0] || '',
        lastName: shippingDetails?.name?.split(' ').slice(1).join(' ') || '',
        items: order.items.map((orderItem) => ({
          id: orderItem.id,
          name: orderItem.productName,
          price: Number(orderItem.price),
          quantity: orderItem.quantity,
          variation: (orderItem.variation as any)?.name || 'Standard',
          image: orderItem.product.images?.[0]?.url || 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=100',
        })),
      };
    });
  }
}
