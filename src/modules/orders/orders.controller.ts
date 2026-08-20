import { Controller, Get, UseGuards } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { GetUser } from '../../common/decorators/user.decorator';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  /**
   * Endpoint for logged-in customers to fetch their own order history records.
   * 
   * @param userId Injected database ID of the authenticated user.
   */
  @Get()
  async getMyOrders(@GetUser('id') userId: string) {
    return this.ordersService.findUserOrders(userId);
  }
}
