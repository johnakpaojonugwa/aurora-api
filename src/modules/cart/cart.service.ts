import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AddToCartDto } from './dto/add-to-cart.dto';
import {
  Cart,
  CartItem,
  Product,
  ProductImage,
  ProductVariation,
} from '@prisma/client';

type ProductWithDetails = Product & {
  images: ProductImage[];
  variations: ProductVariation[];
};

type CartItemWithProduct = CartItem & {
  product: ProductWithDetails;
};

type CartWithItems = Cart & {
  items: CartItemWithProduct[];
};

@Injectable()
export class CartService {
  constructor(private prisma: PrismaService) {}

  async getCart(userId: string) {
    let cart = await this.prisma.cart.findUnique({
      where: { userId },
      include: {
        items: {
          include: {
            product: {
              include: {
                images: true,
                variations: true,
              },
            },
          },
        },
      },
    });

    if (!cart) {
      cart = await this.prisma.cart.create({
        data: { userId },
        include: {
          items: {
            include: {
              product: {
                include: {
                  images: true,
                  variations: true,
                },
              },
            },
          },
        },
      });
    }

    return this.formatCart(cart);
  }

  async addToCart(userId: string, dto: AddToCartDto) {
    const { productId, quantity, variation } = dto;

    // Verify product exists
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: {
        variations: true,
        inventory: true,
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Determine variation ID
    let variationId: string | null = null;
    if (product.variations.length > 0) {
      // Find matching variation name or attributes
      let matchedVar = product.variations.find(
        (v) => v.name.toLowerCase() === variation?.toLowerCase(),
      );

      if (!matchedVar && variation) {
        // Fallback: try parsing variation name or attributes
        matchedVar = product.variations.find((v) => {
          const attrs = v.attributes as Record<string, string>;
          const attrString = Object.entries(attrs)
            .map(([k, val]) => `${k}: ${val}`)
            .join(', ');
          return (
            attrString.toLowerCase().includes(variation.toLowerCase()) ||
            v.sku.toLowerCase() === variation.toLowerCase()
          );
        });
      }

      if (!matchedVar) {
        // Fallback: use first variation
        matchedVar = product.variations[0];
      }

      variationId = matchedVar.id;

      // Check variation stock
      if (matchedVar.stock < quantity) {
        throw new BadRequestException(
          `Insufficient stock for variation ${matchedVar.name}`,
        );
      }
    } else {
      // Check standard inventory stock
      const stock = product.inventory?.quantity || 0;
      if (stock < quantity) {
        throw new BadRequestException('Insufficient stock');
      }
    }

    // Get or create cart
    let cart = await this.prisma.cart.findUnique({
      where: { userId },
    });

    if (!cart) {
      cart = await this.prisma.cart.create({
        data: { userId },
      });
    }

    // Check if item already exists in cart with same product and variation
    const existingItem = await this.prisma.cartItem.findFirst({
      where: {
        cartId: cart.id,
        productId,
        variationId,
      },
    });

    if (existingItem) {
      await this.prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: existingItem.quantity + quantity },
      });
    } else {
      await this.prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productId,
          variationId,
          quantity,
        },
      });
    }

    return this.getCart(userId);
  }

  private formatCart(cart: CartWithItems) {
    const items = cart.items.map((item: CartItemWithProduct) => {
      const prod = item.product;
      const primaryImage =
        prod.images.find((img) => img.isPrimary) || prod.images[0];

      // Determine variation string
      let variationName = 'Standard';
      if (item.variationId && prod.variations.length > 0) {
        const v = prod.variations.find(
          (varItem) => varItem.id === item.variationId,
        );
        if (v) {
          variationName = v.name;
        }
      }

      return {
        id: item.id,
        productId: prod.id,
        name: prod.name,
        price: Number(prod.price),
        image: primaryImage ? primaryImage.url : '',
        variation: variationName,
        quantity: item.quantity,
      };
    });

    return {
      items,
    };
  }
}
