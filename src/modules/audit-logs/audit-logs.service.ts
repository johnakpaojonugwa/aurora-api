import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { generateCsv } from '../../common/utils/csv.util';

@Injectable()
export class AuditLogsService {
  constructor(private prisma: PrismaService) {}

  async log(
    userId: string,
    action: string,
    module: string,
    details: any,
    ip: string,
    userAgent: string,
  ) {
    return this.prisma.auditLog.create({
      data: {
        userId,
        action,
        module,
        details: details || {},
        ip: ip || 'unknown',
        userAgent: userAgent || 'unknown',
      },
    });
  }

  async findAll(query: {
    page?: number;
    limit?: number;
    userId?: string;
    action?: string;
    module?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 50;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.userId) {
      where.userId = query.userId;
    }
    if (query.action) {
      where.action = query.action;
    }
    if (query.module) {
      where.module = query.module;
    }
    if (query.startDate || query.endDate) {
      where.timestamp = {};
      if (query.startDate) {
        where.timestamp.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        where.timestamp.lte = new Date(query.endDate);
      }
    }

    const [total, data] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { timestamp: 'desc' },
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      }),
    ]);

    const formattedData = data.map((log) => ({
      id: log.id,
      userId: log.userId,
      user: {
        name:
          `${log.user.firstName || ''} ${log.user.lastName || ''}`.trim() ||
          log.user.email,
        email: log.user.email,
      },
      action: log.action,
      module: log.module,
      details: log.details,
      ip: log.ip,
      userAgent: log.userAgent,
      timestamp: log.timestamp,
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

  async exportToCsv(query: {
    userId?: string;
    action?: string;
    module?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const where: any = {};

    if (query.userId) {
      where.userId = query.userId;
    }
    if (query.action) {
      where.action = query.action;
    }
    if (query.module) {
      where.module = query.module;
    }
    if (query.startDate || query.endDate) {
      where.timestamp = {};
      if (query.startDate) {
        where.timestamp.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        where.timestamp.lte = new Date(query.endDate);
      }
    }

    const logs = await this.prisma.auditLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    const headers = [
      'Log ID',
      'User ID',
      'User Name',
      'User Email',
      'Action',
      'Module',
      'IP Address',
      'User Agent',
      'Timestamp',
      'Details',
    ];

    const rows = logs.map((log) => {
      const name =
        `${log.user.firstName || ''} ${log.user.lastName || ''}`.trim() ||
        log.user.email;
      return [
        log.id,
        log.userId,
        name,
        log.user.email,
        log.action,
        log.module,
        log.ip,
        log.userAgent,
        log.timestamp.toISOString(),
        JSON.stringify(log.details),
      ];
    });

    return generateCsv(headers, rows);
  }
}
