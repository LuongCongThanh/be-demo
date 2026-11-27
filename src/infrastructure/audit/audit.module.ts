import { Module } from '@nestjs/common';
import { AuditLog } from '#src/infrastructure/audit/audit-log.port.js';
import { AuditLogService } from '#src/infrastructure/audit/audit-log.service.js';

@Module({
  providers: [AuditLogService, { provide: AuditLog, useExisting: AuditLogService }],
  exports: [AuditLogService, AuditLog],
})
export class AuditModule {}
