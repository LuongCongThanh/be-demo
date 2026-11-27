import { Inject, Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { Prisma } from '#src/generated/prisma/client.js';
import { AuditLog, type AuditEntry } from '#src/infrastructure/audit/audit-log.port.js';
import type { PrismaTransactionHost } from '#src/infrastructure/database/cls-transaction-runner.js';
import { RequestContext } from '#src/infrastructure/observability/logging/request-context.js';

/** Dạng cũ (còn tới khi từng module chuyển sang port): caller tự truyền `tx`. */
type LegacyAuditEntry = Omit<AuditEntry, 'before' | 'after'> & {
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
};

/**
 * Ghi `audit_logs` (11-database §4.1). Adapter của `AuditLog`: `record(entry)`
 * dùng client của giao dịch đang mở. Chữ ký cũ `record(tx, entry)` giữ lại cho
 * các service chưa chuyển đổi.
 */
@Injectable()
export class AuditLogService extends AuditLog {
  constructor(@Inject(TransactionHost) private readonly txHost: PrismaTransactionHost) {
    super();
  }

  override record(entry: AuditEntry): Promise<void>;
  record(tx: Prisma.TransactionClient, entry: LegacyAuditEntry): Promise<void>;
  async record(first: AuditEntry | Prisma.TransactionClient, second?: LegacyAuditEntry): Promise<void> {
    const tx = second ? (first as Prisma.TransactionClient) : this.txHost.tx;
    const entry = (second ?? first) as LegacyAuditEntry;
    await tx.auditLog.create({
      data: { ...entry, requestId: RequestContext.getRequestId() },
    });
  }
}
