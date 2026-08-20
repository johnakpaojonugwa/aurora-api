import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductFiltersDto } from './dto/product-filters.dto';
import { Prisma } from '@prisma/client';
import { AdminCreateProductDto } from './dto/admin-create-product.dto';
import { AdminUpdateProductDto } from './dto/admin-update-product.dto';
import { parseCsv } from '../../common/utils/csv.util';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(filters: ProductFiltersDto) {
    const {
      category,
      brand,
      minPrice,
      maxPrice,
      q,
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = filters;

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

    const validSortFields = [
      'id',
      'name',
      'slug',
      'description',
      'price',
      'comparePrice',
      'sku',
      'category',
      'subCategory',
      'brand',
      'isActive',
      'isFeatured',
      'rating',
      'ratingCount',
      'views',
      'createdAt',
      'updatedAt',
    ];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';

    const [total, items] = await Promise.all([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [sortField]: sortOrder,
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
    this.prisma.product
      .update({
        where: { id },
        data: { views: { increment: 1 } },
      })
      .catch((err) => console.error(`Error updating product views: ${err}`));

    return product;
  }

  async create(dto: CreateProductDto) {
    const existing = await this.prisma.product.findFirst({
      where: {
        OR: [{ slug: dto.slug }, { sku: dto.sku }],
      },
    });

    if (existing) {
      throw new ConflictException(
        'Product with this slug or SKU already exists',
      );
    }

    return this.prisma.product.create({
      data: {
        ...dto,
        price: new Prisma.Decimal(dto.price),
        comparePrice: dto.comparePrice
          ? new Prisma.Decimal(dto.comparePrice)
          : null,
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
        throw new ConflictException(
          'Product with this slug or SKU already exists',
        );
      }
    }

    return this.prisma.product.update({
      where: { id },
      data: {
        ...dto,
        price:
          dto.price !== undefined ? new Prisma.Decimal(dto.price) : undefined,
        comparePrice:
          dto.comparePrice !== undefined
            ? dto.comparePrice
              ? new Prisma.Decimal(dto.comparePrice)
              : null
            : undefined,
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

  // ============ ADMIN PRODUCT MANAGEMENT ============

  async adminFindAll(query: {
    page?: number;
    limit?: number;
    search?: string;
    category?: string;
    status?: 'active' | 'inactive';
    stockStatus?: 'in_stock' | 'out_of_stock' | 'low_stock';
    sortBy?: 'name' | 'price' | 'stock' | 'createdAt';
    sortOrder?: 'asc' | 'desc';
  }) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.ProductWhereInput = {};

    if (query.category) {
      where.category = query.category;
    }

    if (query.status) {
      where.isActive = query.status === 'active';
    }

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { sku: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.stockStatus) {
      if (query.stockStatus === 'in_stock') {
        where.inventory = { quantity: { gt: 0 } };
      } else if (query.stockStatus === 'out_of_stock') {
        where.inventory = { quantity: 0 };
      } else if (query.stockStatus === 'low_stock') {
        where.inventory = {
          quantity: { lte: this.prisma.inventory.fields.lowThreshold },
        };
      }
    }

    const sortBy = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder || 'desc';
    const orderBy: any = {};

    if (sortBy === 'stock') {
      orderBy.inventory = { quantity: sortOrder };
    } else {
      orderBy[sortBy] = sortOrder;
    }

    const [total, data] = await Promise.all([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          images: true,
          variations: true,
          inventory: true,
        },
      }),
    ]);

    const formattedData = data.map((product) => ({
      id: product.id,
      name: product.name,
      slug: product.slug,
      sku: product.sku,
      price: Number(product.price),
      stock: product.inventory?.quantity || 0,
      category: product.category,
      images: product.images.map((img) => img.url),
      isActive: product.isActive,
      createdAt: product.createdAt,
      variations: product.variations.map((v) => ({
        id: v.id,
        name: v.name,
        sku: v.sku,
        price: v.price ? Number(v.price) : null,
        attributes: v.attributes,
        stock: v.stock,
      })),
    }));

    return {
      data: formattedData,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async adminCreate(dto: AdminCreateProductDto) {
    const existing = await this.prisma.product.findFirst({
      where: {
        OR: [{ slug: dto.seo.slug }, { sku: dto.sku }],
      },
    });

    if (existing) {
      throw new ConflictException(
        'Product with this slug or SKU already exists',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          name: dto.name,
          slug: dto.seo.slug,
          description: dto.description,
          price: new Prisma.Decimal(dto.price),
          comparePrice: dto.comparePrice
            ? new Prisma.Decimal(dto.comparePrice)
            : null,
          sku: dto.sku,
          category: dto.category,
          isActive: dto.isActive,
        },
      });

      if (dto.images && dto.images.length > 0) {
        await tx.productImage.createMany({
          data: dto.images.map((url, idx) => ({
            productId: product.id,
            url,
            isPrimary: idx === 0,
            sortOrder: idx,
          })),
        });
      }

      if (dto.variations && dto.variations.length > 0) {
        await tx.productVariation.createMany({
          data: dto.variations.map((v) => ({
            productId: product.id,
            name: v.name,
            sku: v.sku,
            price: new Prisma.Decimal(v.price),
            attributes: v.attributes as any,
            stock: v.stock,
          })),
        });
      }

      await tx.inventory.create({
        data: {
          productId: product.id,
          quantity: dto.stock,
          lowThreshold: 5,
          isInStock: dto.stock > 0,
        },
      });

      return tx.product.findUnique({
        where: { id: product.id },
        include: {
          images: true,
          variations: true,
          inventory: true,
        },
      });
    });
  }

  async adminUpdate(id: string, dto: AdminUpdateProductDto) {
    const product = await this.findOne(id);

    if (dto.seo?.slug || dto.sku) {
      const conditions: any[] = [];
      if (dto.seo?.slug) conditions.push({ slug: dto.seo.slug });
      if (dto.sku) conditions.push({ sku: dto.sku });

      const existing = await this.prisma.product.findFirst({
        where: {
          id: { not: id },
          OR: conditions,
        },
      });

      if (existing) {
        throw new ConflictException(
          'Product with this slug or SKU already exists',
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id },
        data: {
          name: dto.name,
          slug: dto.seo?.slug,
          description: dto.description,
          price:
            dto.price !== undefined ? new Prisma.Decimal(dto.price) : undefined,
          comparePrice:
            dto.comparePrice !== undefined
              ? dto.comparePrice
                ? new Prisma.Decimal(dto.comparePrice)
                : null
              : undefined,
          sku: dto.sku,
          category: dto.category,
          isActive: dto.isActive,
        },
      });

      if (dto.images) {
        await tx.productImage.deleteMany({ where: { productId: id } });
        if (dto.images.length > 0) {
          await tx.productImage.createMany({
            data: dto.images.map((url, idx) => ({
              productId: id,
              url,
              isPrimary: idx === 0,
              sortOrder: idx,
            })),
          });
        }
      }

      if (dto.variations) {
        await tx.productVariation.deleteMany({ where: { productId: id } });
        if (dto.variations.length > 0) {
          await tx.productVariation.createMany({
            data: dto.variations.map((v) => ({
              productId: id,
              name: v.name,
              sku: v.sku,
              price: new Prisma.Decimal(v.price),
              attributes: v.attributes as any,
              stock: v.stock,
            })),
          });
        }
      }

      if (dto.stock !== undefined) {
        await tx.inventory.upsert({
          where: { productId: id },
          update: {
            quantity: dto.stock,
            isInStock: dto.stock > 0,
          },
          create: {
            productId: id,
            quantity: dto.stock,
            isInStock: dto.stock > 0,
          },
        });
      }

      return tx.product.findUnique({
        where: { id },
        include: {
          images: true,
          variations: true,
          inventory: true,
        },
      });
    });
  }

  async adminBulkUpdate(dto: {
    productIds: string[];
    updates: { status?: boolean; stock?: number; price?: number };
  }) {
    const { productIds, updates } = dto;
    return this.prisma.$transaction(async (tx) => {
      if (updates.status !== undefined) {
        await tx.product.updateMany({
          where: { id: { in: productIds } },
          data: { isActive: updates.status },
        });
      }

      if (updates.price !== undefined) {
        await tx.product.updateMany({
          where: { id: { in: productIds } },
          data: { price: new Prisma.Decimal(updates.price) },
        });
      }

      if (updates.stock !== undefined) {
        for (const pid of productIds) {
          await tx.inventory.upsert({
            where: { productId: pid },
            update: {
              quantity: updates.stock,
              isInStock: updates.stock > 0,
            },
            create: {
              productId: pid,
              quantity: updates.stock,
              isInStock: updates.stock > 0,
            },
          });
        }
      }

      return { success: true, count: productIds.length };
    });
  }

  async adminImportCsv(buffer: Buffer) {
    const csvString = buffer.toString('utf-8');
    const rows = parseCsv(csvString);

    if (rows.length < 2) {
      return {
        success: 0,
        skipped: 0,
        errors: ['CSV file is empty or missing data rows'],
      };
    }

    const headers = rows[0].map((h) => h.toLowerCase());
    const dataRows = rows.slice(1);

    let successCount = 0;
    const skippedCount = 0;
    const errors: string[] = [];

    const nameIdx = headers.indexOf('name');
    const skuIdx = headers.indexOf('sku');
    const priceIdx = headers.indexOf('price');
    const categoryIdx = headers.indexOf('category');
    const descriptionIdx = headers.indexOf('description');
    const stockIdx = headers.indexOf('stock');
    const imagesIdx =
      headers.indexOf('images') !== -1
        ? headers.indexOf('images')
        : headers.indexOf('image');

    if (
      nameIdx === -1 ||
      skuIdx === -1 ||
      priceIdx === -1 ||
      categoryIdx === -1
    ) {
      return {
        success: 0,
        skipped: 0,
        errors: [
          `Missing required columns. Found headers: ${headers.join(', ')}`,
        ],
      };
    }

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      if (row.length < 4) {
        errors.push(`Row ${i + 2}: Invalid number of columns`);
        continue;
      }

      const name = row[nameIdx];
      const sku = row[skuIdx];
      const priceVal = parseFloat(row[priceIdx]);
      const category = row[categoryIdx];
      const description = descriptionIdx !== -1 ? row[descriptionIdx] : '';
      const stockVal = stockIdx !== -1 ? parseInt(row[stockIdx], 10) : 0;
      const imagesStr = imagesIdx !== -1 ? row[imagesIdx] : '';
      const imageUrls = imagesStr
        ? imagesStr
            .split(',')
            .map((url) => url.trim())
            .filter(Boolean)
        : [];

      if (!name || !sku || isNaN(priceVal) || !category) {
        errors.push(`Row ${i + 2}: Invalid name, sku, price, or category`);
        continue;
      }

      // Check if product with SKU exists
      const existingProduct = await this.prisma.product.findUnique({
        where: { sku },
      });

      try {
        if (existingProduct) {
          // Update
          await this.prisma.$transaction(async (tx) => {
            await tx.product.update({
              where: { id: existingProduct.id },
              data: {
                name,
                description,
                price: new Prisma.Decimal(priceVal),
                category,
              },
            });

            await tx.inventory.upsert({
              where: { productId: existingProduct.id },
              update: {
                quantity: stockVal,
                isInStock: stockVal > 0,
              },
              create: {
                productId: existingProduct.id,
                quantity: stockVal,
                isInStock: stockVal > 0,
              },
            });

            if (imageUrls.length > 0) {
              await tx.productImage.deleteMany({
                where: { productId: existingProduct.id },
              });
              await tx.productImage.createMany({
                data: imageUrls.map((url, idx) => ({
                  productId: existingProduct.id,
                  url,
                  isPrimary: idx === 0,
                  sortOrder: idx,
                })),
              });
            }
          });
          successCount++;
        } else {
          // Create
          const slug = name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)+/g, '');

          const uniqueSlug = `${slug}-${Date.now()}`;

          await this.prisma.$transaction(async (tx) => {
            const product = await tx.product.create({
              data: {
                name,
                slug: uniqueSlug,
                description,
                sku,
                price: new Prisma.Decimal(priceVal),
                category,
                isActive: true,
              },
            });

            await tx.inventory.create({
              data: {
                productId: product.id,
                quantity: stockVal,
                isInStock: stockVal > 0,
              },
            });

            if (imageUrls.length > 0) {
              await tx.productImage.createMany({
                data: imageUrls.map((url, idx) => ({
                  productId: product.id,
                  url,
                  isPrimary: idx === 0,
                  sortOrder: idx,
                })),
              });
            }
          });
          successCount++;
        }
      } catch (err) {
        errors.push(`Row ${i + 2}: Database error - ${err.message}`);
      }
    }

    return {
      success: successCount,
      skipped: skippedCount,
      errors,
    };
  }
}
