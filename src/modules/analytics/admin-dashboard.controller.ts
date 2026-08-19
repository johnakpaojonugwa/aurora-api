import { Controller, Get, UseGuards, UseInterceptors } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuditLogInterceptor } from '../audit-logs/audit-logs.interceptor';

@Controller('admin/dashboard-overview')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'manager')
@UseInterceptors(AuditLogInterceptor)
export class AdminDashboardController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get()
  async getOverview() {
    return this.analyticsService.getDashboardOverview();
  }
}
