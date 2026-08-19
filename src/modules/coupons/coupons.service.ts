import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';
import { GenerateCouponsDto } from './dto/generate-coupons.dto';

@Injectable()
export class CouponsService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: {
    page?: number;
    limit?: number;
    isActive?: boolean;
    search?: string;
  }) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.isActive !== undefined) {
      // Handle potential string to boolean conversion from query param
      where.isActive = String(query.isActive) === 'true';
    }

    if (query.search) {
      where.code = {
        contains: query.search,
        mode: 'insensitive',
      };
    }

    const [total, data] = await Promise.all([
      this.prisma.coupon.count({ where }),
      this.prisma.coupon.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const formattedData = data.map((coupon) => ({
      id: coupon.id,
      code: coupon.code,
      type: coupon.type,
      value: Number(coupon.value),
      minOrder: coupon.minOrder ? Number(coupon.minOrder) : null,
      maxDiscount: coupon.maxDiscount ? Number(coupon.maxDiscount) : null,
      usageLimit: coupon.usageLimit,
      usedCount: coupon.usedCount,
      validFrom: coupon.validFrom,
      validUntil: coupon.validUntil,
      isActive: coupon.isActive,
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

  async findOne(id: string) {
    const coupon = await this.prisma.coupon.findUnique({
      where: { id },
    });

    if (!coupon) {
      throw new NotFoundException('Coupon not found');
    }

    return {
      ...coupon,
      value: Number(coupon.value),
      minOrder: coupon.minOrder ? Number(coupon.minOrder) : null,
      maxDiscount: coupon.maxDiscount ? Number(coupon.maxDiscount) : null,
    };
  }

  async create(dto: CreateCouponDto) {
    const existing = await this.prisma.coupon.findUnique({
      where: { code: dto.code.toUpperCase() },
    });

    if (existing) {
      throw new ConflictException('Coupon code already exists');
    }

    const coupon = await this.prisma.coupon.create({
      data: {
        ...dto,
        code: dto.code.toUpperCase(),
      },
    });

    return {
      ...coupon,
      value: Number(coupon.value),
      minOrder: coupon.minOrder ? Number(coupon.minOrder) : null,
      maxDiscount: coupon.maxDiscount ? Number(coupon.maxDiscount) : null,
    };
  }

  async update(id: string, dto: UpdateCouponDto) {
    // Check existence
    await this.findOne(id);

    if (dto.code) {
      const existing = await this.prisma.coupon.findFirst({
        where: {
          code: dto.code.toUpperCase(),
          id: { not: id },
        },
      });
      if (existing) {
        throw new ConflictException('Coupon code already exists');
      }
    }

    const updated = await this.prisma.coupon.update({
      where: { id },
      data: {
        ...dto,
        code: dto.code ? dto.code.toUpperCase() : undefined,
      },
    });

    return {
      ...updated,
      value: Number(updated.value),
      minOrder: updated.minOrder ? Number(updated.minOrder) : null,
      maxDiscount: updated.maxDiscount ? Number(updated.maxDiscount) : null,
    };
  }

  async delete(id: string) {
    await this.findOne(id);
    await this.prisma.coupon.delete({
      where: { id },
    });
    return { success: true };
  }

  async generate(dto: GenerateCouponsDto) {
    const generatedCodes: string[] = [];
    const validFrom = new Date();
    const validUntil = new Date();
    validUntil.setFullYear(validUntil.getFullYear() + 1); // 1 year validity default

    const makeRandomString = (length: number) => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let result = '';
      for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return result;
    };

    // We will attempt to generate unique codes
    let attempts = 0;
    const maxAttempts = dto.count * 10;

    while (generatedCodes.length < dto.count && attempts < maxAttempts) {
      attempts++;
      const randomPart = makeRandomString(6);
      const code = `${dto.prefix.toUpperCase()}-${randomPart}`;

      // Check if duplicate in generated list
      if (generatedCodes.includes(code)) continue;

      // Check if duplicate in DB
      const existing = await this.prisma.coupon.findUnique({
        where: { code },
      });

      if (!existing) {
        generatedCodes.push(code);
      }
    }

    if (generatedCodes.length < dto.count) {
      throw new ConflictException(
        'Unable to generate unique coupon codes. Try a different prefix.',
      );
    }

    // Save all to database
    await this.prisma.coupon.createMany({
      data: generatedCodes.map((code) => ({
        code,
        type: dto.type,
        value: dto.value,
        validFrom,
        validUntil,
        isActive: true,
      })),
    });

    return generatedCodes;
  }
}
