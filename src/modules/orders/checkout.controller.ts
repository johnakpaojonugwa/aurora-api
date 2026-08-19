import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CheckoutDto } from './dto/checkout.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { GetUser } from '../../common/decorators/user.decorator';

@Controller('checkout')
@UseGuards(JwtAuthGuard)
export class CheckoutController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  async checkout(@GetUser('id') userId: string, @Body() dto: CheckoutDto) {
    return this.ordersService.processCheckout(userId, dto);
  }
}
