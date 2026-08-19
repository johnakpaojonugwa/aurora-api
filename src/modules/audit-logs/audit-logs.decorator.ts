import { SetMetadata } from '@nestjs/common';

export const AUDIT_LOG_KEY = 'audit_log';

export interface AuditLogMetadata {
  action: string;
  module: string;
}

export const AuditLogAction = (action: string, module: string) =>
  SetMetadata(AUDIT_LOG_KEY, { action, module });
