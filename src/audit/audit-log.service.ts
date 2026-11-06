import { Injectable } from '@nestjs/common';
import { Prisma } from '#src/generated/prisma/client.js';
import { RequestContext } from '#src/common/request-context.js';

export interface AuditEntry {
  /** null = hệ thống (vd. CLI `create-admin`). */
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
  reason?: string;
}

/**
 * Ghi `audit_logs` (11-database §4.1). Luôn nhận `tx` của caller để dòng audit
 * nằm cùng transaction với thao tác được ghi — thao tác rollback thì audit
 * cũng mất, không bao giờ có audit "ma".
 */
@Injectable()
export class AuditLogService {
  async record(tx: Prisma.TransactionClient, entry: AuditEntry): Promise<void> {
    await tx.auditLog.create({
      data: { ...entry, requestId: RequestContext.getRequestId() },
    });
  }
}
