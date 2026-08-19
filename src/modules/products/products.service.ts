import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductFiltersDto } from './dto/product-filters.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(filters: ProductFiltersDto) {
    const { category, brand, minPrice, maxPrice, q, page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = filters;

    const where: Prisma.ProductWhereInput = { isActive: true };

    if (category) {
      where.category = category;
    }

    if (brand) {
      where.brand = brand;
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      where.price = {};
      if (minPrice !== undefined) {
        where.price.gte = minPrice;
      }
      if (maxPrice !== undefined) {
        where.price.lte = maxPrice;
      }
    }

    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { tags: { has: q } },
      ];
    }

    const skip = (page - 1) * limit;

    const [total, items] = await Promise.all([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [sortBy]: sortOrder,
        },
        include: {
          images: true,
          variations: true,
          inventory: true,
        },
      }),
    ]);

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async search(query: string, filters: ProductFiltersDto) {
    filters.q = query;
    return this.findAll(filters);
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        images: true,
        variations: true,
        inventory: true,
      },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    // Increment views in the background
    this.prisma.product.update({
      where: { id },
      data: { views: { increment: 1 } },
    }).catch((err) => console.error(`Error updating product views: ${err}`));

    return product;
  }

  async create(dto: CreateProductDto) {
    // Check slug and SKU uniqueness
    const existing = await this.prisma.product.findFirst({
      where: {
        OR: [
          { slug: dto.slug },
          { sku: dto.sku },
        ],
      },
    });

    if (existing) {
      throw new ConflictException('Product with this slug or SKU already exists');
    }

    return this.prisma.product.create({
      data: {
        ...dto,
        price: new Prisma.Decimal(dto.price),
        comparePrice: dto.comparePrice ? new Prisma.Decimal(dto.comparePrice) : null,
      },
      include: {
        images: true,
        variations: true,
        inventory: true,
      },
    });
  }

  async update(id: string, dto: UpdateProductDto) {
    await this.findOne(id);

    if (dto.slug || dto.sku) {
      const conditions: Prisma.ProductWhereInput[] = [];
      if (dto.slug) conditions.push({ slug: dto.slug });
      if (dto.sku) conditions.push({ sku: dto.sku });

      const existing = await this.prisma.product.findFirst({
        where: {
          id: { not: id },
          OR: conditions,
        },
      });

      if (existing) {
        throw new ConflictException('Product with this slug or SKU already exists');
      }
    }

    return this.prisma.product.update({
      where: { id },
      data: {
        ...dto,
        price: dto.price !== undefined ? new Prisma.Decimal(dto.price) : undefined,
        comparePrice: dto.comparePrice !== undefined ? (dto.comparePrice ? new Prisma.Decimal(dto.comparePrice) : null) : undefined,
      },
      include: {
        images: true,
        variations: true,
        inventory: true,
      },
    });
  }

  async delete(id: string) {
    await this.findOne(id);
    await this.prisma.product.delete({
      where: { id },
    });
    return { success: true };
  }
}
