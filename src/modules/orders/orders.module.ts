import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { AdminOrdersController } from './admin-orders.controller';
import { CheckoutController } from './checkout.controller';

@Module({
  controllers: [OrdersController, AdminOrdersController, CheckoutController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
