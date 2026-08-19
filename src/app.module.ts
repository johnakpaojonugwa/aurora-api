import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { ThrottlerModule } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bull';

import configuration from './config/configuration';
import { validationSchema } from './config/validation-schema';

import { PrismaModule } from './database/prisma.module';
import { RedisModule } from './redis/redis.module';
import { QueueModule } from './queue/queue.module';

import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ProductsModule } from './modules/products/products.module';
import { CartModule } from './modules/cart/cart.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { EmailModule } from './modules/email/email.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { AuditLogsModule } from './modules/audit-logs/audit-logs.module';
import { CouponsModule } from './modules/coupons/coupons.module';
import { SettingsModule } from './modules/settings/settings.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema,
    }),

    // Logging
    LoggerModule.forRoot({
      pinoHttp: {
        transport: {
          target: 'pino-pretty',
          options: {
            singleLine: true,
          },
        },
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
      },
    }),

    // Rate limiting
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),

    // BullMQ Queue
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const redisUrl = configService.get<string>('redisUrl');
        return {
          redis: redisUrl
            ? redisUrl
            : {
                host: configService.get<string>('redisHost', 'localhost'),
                port: configService.get<number>('redisPort', 6379),
                password:
                  configService.get<string>('redisPassword') || undefined,
              },
          defaultJobOptions: {
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 1000,
            },
            removeOnComplete: true,
          },
        };
      },
      inject: [ConfigService],
    }),

    // Database
    PrismaModule,
    RedisModule,
    QueueModule,

    // Feature Modules
    AuthModule,
    UsersModule,
    ProductsModule,
    CartModule,
    OrdersModule,
    PaymentsModule,
    EmailModule,
    AnalyticsModule,
    AuditLogsModule,
    CouponsModule,
    SettingsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
