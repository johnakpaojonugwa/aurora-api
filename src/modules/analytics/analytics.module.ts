import { Module } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { AdminAnalyticsController } from './admin-analytics.controller';
import { AdminDashboardController } from './admin-dashboard.controller';
import { PrismaModule } from '../../database/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [
    AnalyticsController,
    AdminAnalyticsController,
    AdminDashboardController,
  ],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
