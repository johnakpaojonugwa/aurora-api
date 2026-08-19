import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { CartService } from './cart.service';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { GetUser } from '../../common/decorators/user.decorator';

@Controller('cart')
@UseGuards(JwtAuthGuard)
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  async getCart(@GetUser('id') userId: string) {
    return this.cartService.getCart(userId);
  }

  @Post('add')
  async addToCart(@GetUser('id') userId: string, @Body() dto: AddToCartDto) {
    return this.cartService.addToCart(userId, dto);
  }
}
