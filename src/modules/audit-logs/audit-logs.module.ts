import { Module, Global } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { AuditLogsService } from './audit-logs.service';
import { AdminAuditLogsController } from './admin-audit-logs.controller';
import { AuditLogInterceptor } from './audit-logs.interceptor';

@Global()
@Module({
  imports: [PrismaModule],
  controllers: [AdminAuditLogsController],
  providers: [AuditLogsService, AuditLogInterceptor],
  exports: [AuditLogsService, AuditLogInterceptor],
})
export class AuditLogsModule {}
