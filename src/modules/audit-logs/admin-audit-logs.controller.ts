import { Controller, Get, Query, UseGuards, Res } from '@nestjs/common';
import * as express from 'express';
import { AuditLogsService } from './audit-logs.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('admin/audit-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminAuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @Get()
  async findAll(
    @Query()
    query: {
      page?: number;
      limit?: number;
      userId?: string;
      action?: string;
      module?: string;
      startDate?: string;
      endDate?: string;
    },
  ) {
    return this.auditLogsService.findAll(query);
  }

  @Get('export')
  async export(
    @Query()
    query: {
      userId?: string;
      action?: string;
      module?: string;
      startDate?: string;
      endDate?: string;
    },
    @Res() res: express.Response,
  ) {
    const csv = await this.auditLogsService.exportToCsv(query);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=audit-logs.csv');
    return res.status(200).send(csv);
  }
}
