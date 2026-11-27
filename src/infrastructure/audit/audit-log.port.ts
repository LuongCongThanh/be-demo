export type AuditJson = string | number | boolean | AuditJson[] | { [key: string]: AuditJson | null };

export interface AuditEntry {
  /** null = hệ thống (vd. CLI `create-admin`). */
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  before?: AuditJson;
  after?: AuditJson;
  reason?: string;
}

/**
 * Port ghi audit log. Adapter tham gia giao dịch đang mở nên dòng audit nằm
 * cùng giao dịch với thao tác được ghi (rollback thì audit cũng mất).
 */
export abstract class AuditLog {
  abstract record(entry: AuditEntry): Promise<void>;
}
