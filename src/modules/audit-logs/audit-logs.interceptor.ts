import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditLogsService } from './audit-logs.service';
import { AUDIT_LOG_KEY, AuditLogMetadata } from './audit-logs.decorator';

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(
    private reflector: Reflector,
    private auditLogsService: AuditLogsService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const auditMetadata = this.reflector.getAllAndOverride<AuditLogMetadata>(
      AUDIT_LOG_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!auditMetadata) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const { method, url, ip, body } = request;
    const userAgent = request.headers['user-agent'] || 'unknown';
    const user = request.user;

    return next.handle().pipe(
      tap({
        next: async (response) => {
          // Log only successful actions (or if we want, we can log everything, but standard is successful operations)
          if (user && user.id) {
            // Sanitize body to avoid saving sensitive information like passwords
            const sanitizedBody = { ...body };
            if (sanitizedBody.password) sanitizedBody.password = '***';
            if (sanitizedBody.passwordHash) sanitizedBody.passwordHash = '***';
            if (sanitizedBody.refreshToken) sanitizedBody.refreshToken = '***';
            if (sanitizedBody.mfaSecret) sanitizedBody.mfaSecret = '***';

            const details = {
              method,
              url,
              requestBody: sanitizedBody,
              responseId: response?.id || response?.data?.id || undefined,
            };

            try {
              await this.auditLogsService.log(
                user.id,
                auditMetadata.action,
                auditMetadata.module,
                details,
                ip,
                userAgent,
              );
            } catch (err) {
              console.error(
                '[AuditLogInterceptor] Failed to save audit log:',
                err,
              );
            }
          }
        },
      }),
    );
  }
}
