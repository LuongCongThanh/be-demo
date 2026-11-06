import { Module } from '@nestjs/common';
import { AuditLogService } from '#src/infrastructure/audit/audit-log.service.js';

@Module({
  providers: [AuditLogService],
  exports: [AuditLogService],
})
export class AuditModule {}
