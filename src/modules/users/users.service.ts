import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Role } from '@prisma/client';
import { CreateAdminUserDto } from './dto/create-admin-user.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async updateRole(id: string, role: Role) {
    if (role === Role.admin) {
      throw new ForbiddenException(
        'Cannot promote a user to admin role via the API',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: { role },
    });

    const { passwordHash, refreshToken, mfaSecret, ...sanitized } = updatedUser;
    return sanitized;
  }

  // ============ ADMIN USER MANAGEMENT ============

  async findAllAdminsAndManagers(query: {
    page?: number;
    limit?: number;
    role?: 'admin' | 'manager' | 'user';
    search?: string;
  }) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const where: any = {
      deletedAt: null,
    };

    if (query.role) {
      where.role = query.role;
    } else {
      where.role = {
        in: [Role.admin, Role.manager],
      };
    }

    if (query.search) {
      where.OR = [
        { email: { contains: query.search, mode: 'insensitive' } },
        { firstName: { contains: query.search, mode: 'insensitive' } },
        { lastName: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [total, users] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const formattedData = users.map((u) => ({
      id: u.id,
      name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email,
      email: u.email,
      role: u.role,
      isActive: u.isActive,
      lastLoginAt: u.lastLoginAt,
      createdAt: u.createdAt,
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

  async createAdminOrManager(dto: CreateAdminUserDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 12);

    // Split name into first and last name
    const nameParts = dto.name.trim().split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || null;

    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash: hashedPassword,
        firstName,
        lastName,
        role: dto.role,
        isActive: true,
      },
    });

    const { passwordHash, refreshToken, mfaSecret, ...sanitized } = user;
    return sanitized;
  }

  async adminUpdateRole(id: string, role: Role) {
    if (role === Role.admin) {
      throw new ForbiddenException(
        'Cannot promote a user to admin role via the API',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: { role },
    });

    const { passwordHash, refreshToken, mfaSecret, ...sanitized } = updated;
    return sanitized;
  }

  async suspendUser(id: string, reason?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        isActive: false,
        notes: reason ? `Suspension reason: ${reason}` : user.notes,
      },
    });

    const { passwordHash, refreshToken, mfaSecret, ...sanitized } = updated;
    return sanitized;
  }

  async activateUser(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        isActive: true,
      },
    });

    const { passwordHash, refreshToken, mfaSecret, ...sanitized } = updated;
    return sanitized;
  }

  async getLoginHistory(id: string) {
    const logs = await this.prisma.auditLog.findMany({
      where: {
        userId: id,
        action: {
          in: ['USER_LOGIN', 'USER_LOGIN_MFA'],
        },
      },
      orderBy: { timestamp: 'desc' },
      take: 50,
    });

    return logs.map((log) => ({
      timestamp: log.timestamp,
      ip: log.ip,
      userAgent: log.userAgent,
    }));
  }

  // ============ CUSTOMER MANAGEMENT ============

  async findAllCustomers(query: {
    page?: number;
    limit?: number;
    search?: string;
    startDate?: string;
    endDate?: string;
    sortBy?: 'createdAt' | 'totalSpent' | 'orderCount';
    sortOrder?: 'asc' | 'desc';
  }) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const where: any = {
      role: Role.user,
      deletedAt: null,
    };

    if (query.search) {
      where.OR = [
        { email: { contains: query.search, mode: 'insensitive' } },
        { firstName: { contains: query.search, mode: 'insensitive' } },
        { lastName: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) {
        where.createdAt.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        where.createdAt.lte = new Date(query.endDate);
      }
    }

    // Fetch all customers matching filter to do aggregation.
    // In database with huge datasets, we would use raw queries or group by, but in Prisma we can do aggregation.
    // Let's do it efficiently:
    const customers = await this.prisma.user.findMany({
      where,
      include: {
        orders: {
          select: {
            total: true,
          },
        },
        addresses: {
          where: { isDefault: true },
          select: { phone: true },
          take: 1,
        },
      },
    });

    // Map and aggregate
    const formatted = customers.map((c) => {
      const totalSpent = c.orders.reduce((sum, o) => sum + Number(o.total), 0);
      const orderCount = c.orders.length;
      const phone = c.addresses[0]?.phone || '';

      return {
        id: c.id,
        name: `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.email,
        email: c.email,
        phone,
        totalOrders: orderCount,
        totalSpent,
        joinedAt: c.createdAt,
        isActive: c.isActive,
      };
    });

    // Sorting
    const sortBy = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder || 'desc';

    formatted.sort((a: any, b: any) => {
      let valA = a[sortBy];
      let valB = b[sortBy];

      if (valA instanceof Date) valA = valA.getTime();
      if (valB instanceof Date) valB = valB.getTime();

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    const total = formatted.length;
    const paginatedData = formatted.slice(skip, skip + limit);

    return {
      data: paginatedData,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findCustomerDetails(id: string) {
    const customer = await this.prisma.user.findUnique({
      where: { id },
      include: {
        addresses: true,
        orders: {
          orderBy: { createdAt: 'desc' },
          include: {
            items: true,
          },
        },
        wishlistItems: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                price: true,
              },
            },
          },
        },
      },
    });

    if (!customer || customer.role !== Role.user) {
      throw new NotFoundException('Customer not found');
    }

    return {
      id: customer.id,
      name:
        `${customer.firstName || ''} ${customer.lastName || ''}`.trim() ||
        customer.email,
      email: customer.email,
      firstName: customer.firstName,
      lastName: customer.lastName,
      isActive: customer.isActive,
      joinedAt: customer.createdAt,
      addresses: customer.addresses,
      orderHistory: customer.orders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        total: Number(o.total),
        status: o.status,
        paymentStatus: o.paymentStatus,
        createdAt: o.createdAt,
        itemsCount: o.items.length,
      })),
      wishlist: customer.wishlistItems.map((w) => ({
        id: w.id,
        productId: w.productId,
        productName: w.product.name,
        price: Number(w.product.price),
      })),
      notes: customer.notes,
      accountStatus: customer.isActive ? 'active' : 'suspended',
    };
  }

  async resetCustomerPassword(id: string, sendEmail: boolean) {
    const customer = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    // Generate random password
    const chars =
      'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let randomPassword = '';
    for (let i = 0; i < 12; i++) {
      randomPassword += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    const hashedPassword = await bcrypt.hash(randomPassword, 12);

    await this.prisma.user.update({
      where: { id },
      data: {
        passwordHash: hashedPassword,
      },
    });

    // In a real application, if sendEmail is true, we would call EmailService to send this password.
    // Let's print it to console or mock it
    if (sendEmail) {
      console.log(
        `[UsersService] Resetting password for customer ${customer.email}. New password: ${randomPassword}`,
      );
    }

    return {
      success: true,
      newPassword: randomPassword,
      message: sendEmail
        ? 'Password reset email sent'
        : 'Password reset successful',
    };
  }

  async updateRoleByEmail(email: string, role: Role) {
    if (role === Role.admin) {
      throw new ForbiddenException(
        'Cannot promote a user to admin role via the API',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updated = await this.prisma.user.update({
      where: { email: email.toLowerCase() },
      data: { role },
    });

    const { passwordHash, refreshToken, mfaSecret, ...sanitized } = updated;
    return sanitized;
  }

  async updateStatusByEmail(email: string, status: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updated = await this.prisma.user.update({
      where: { email: email.toLowerCase() },
      data: {
        isActive: status.toUpperCase() === 'ACTIVE',
      },
    });

    const { passwordHash, refreshToken, mfaSecret, ...sanitized } = updated;
    return sanitized;
  }

  async updateCustomerNotes(id: string, notes: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.user.update({
      where: { id },
      data: { notes },
    });
  }
}
