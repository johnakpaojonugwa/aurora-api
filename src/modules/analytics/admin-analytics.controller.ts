import {
  Controller,
  Get,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuditLogInterceptor } from '../audit-logs/audit-logs.interceptor';

@Controller('admin/analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(AuditLogInterceptor)
export class AdminAnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('sales')
  @Roles('admin', 'manager')
  async getSales(
    @Query()
    query: {
      startDate?: string;
      endDate?: string;
      granularity?: 'day' | 'week' | 'month';
      region?: string;
    },
  ) {
    return this.analyticsService.getSalesAnalytics(query);
  }

  @Get('products')
  @Roles('admin')
  async getProducts(
    @Query()
    query: {
      period?: 'today' | 'week' | 'month' | 'year';
      limit?: number;
    },
  ) {
    return this.analyticsService.getProductAnalytics(query);
  }

  @Get('customers')
  @Roles('admin')
  async getCustomers(
    @Query()
    query: {
      period?: 'today' | 'week' | 'month' | 'year';
      limit?: number;
    },
  ) {
    return this.analyticsService.getCustomerAnalytics(query);
  }

  @Get('regions')
  @Roles('admin')
  async getRegions(
    @Query()
    query: {
      period?: 'week' | 'month' | 'year';
    },
  ) {
    return this.analyticsService.getRegionalAnalytics(query);
  }

  @Get('inventory')
  @Roles('admin', 'manager')
  async getInventory() {
    return this.analyticsService.getInventoryAnalytics();
  }
}
