import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
  Res,
} from '@nestjs/common';
import * as express from 'express';
import { OrdersService } from './orders.service';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { RefundOrderDto } from './dto/refund-order.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuditLogInterceptor } from '../audit-logs/audit-logs.interceptor';
import { AuditLogAction } from '../audit-logs/audit-logs.decorator';
import { OrderStatus, PaymentStatus } from '@prisma/client';

@Controller('admin/orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(AuditLogInterceptor)
export class AdminOrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @Roles('admin', 'manager')
  async findAll(
    @Query()
    query: {
      page?: number;
      limit?: number;
      search?: string;
      status?: OrderStatus;
      paymentStatus?: PaymentStatus;
      startDate?: string;
      endDate?: string;
      sortBy?: 'createdAt' | 'total' | 'status';
      sortOrder?: 'asc' | 'desc';
    },
  ) {
    return this.ordersService.adminFindAll(query);
  }

  @Get('export')
  @Roles('admin')
  async export(
    @Query()
    query: {
      status?: OrderStatus;
      startDate?: string;
      endDate?: string;
    },
    @Res() res: express.Response,
  ) {
    const csv = await this.ordersService.adminExportCsv(query);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=orders.csv');
    return res.status(200).send(csv);
  }

  @Get(':id')
  @Roles('admin', 'manager')
  async findOne(@Param('id') id: string) {
    return this.ordersService.adminFindOne(id);
  }

  @Put(':id/status')
  @Roles('admin', 'manager')
  @AuditLogAction('ORDER_STATUS_UPDATED', 'orders')
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.ordersService.adminUpdateStatus(id, dto);
  }

  @Post(':id/refund')
  @Roles('admin')
  @AuditLogAction('ORDER_REFUNDED', 'orders')
  async refund(@Param('id') id: string, @Body() dto: RefundOrderDto) {
    return this.ordersService.adminRefund(id, dto);
  }

  @Post('bulk-status')
  @Roles('admin', 'manager')
  @AuditLogAction('ORDER_BULK_STATUS_UPDATED', 'orders')
  async bulkStatus(
    @Body()
    dto: {
      orderIds: string[];
      status: OrderStatus;
    },
  ) {
    return this.ordersService.adminBulkStatus(dto);
  }
}
