export type IdempotencyJson = string | number | boolean | IdempotencyJson[] | { [key: string]: IdempotencyJson | null };

export interface IdempotencyRecord {
  requestHash: string;
  /** null khi yêu cầu đầu tiên chưa hoàn tất (đang xử lý). */
  responseStatus: number | null;
  response: IdempotencyJson | null;
}

/** Lưu kết quả theo `Idempotency-Key`; mọi method tham gia giao dịch đang mở nếu có. */
export abstract class IdempotencyStore {
  abstract find(scope: string, key: string): Promise<IdempotencyRecord | null>;
  /** Ném lỗi unique của Prisma (P2002) khi `(scope, key)` đã tồn tại. */
  abstract start(scope: string, key: string, requestHash: string): Promise<void>;
  abstract complete(scope: string, key: string, status: number, response: IdempotencyJson): Promise<void>;
}
