/** Cùng dạng với `Prisma.JsonValue` nên cột JSON đọc/ghi không cần ép kiểu. */
export type IdempotencyJson =
  string | number | boolean | null | IdempotencyJson[] | { [key: string]: IdempotencyJson | undefined };

export interface IdempotencyRecord {
  requestHash: string;
  /** null khi yêu cầu đầu tiên chưa hoàn tất (đang xử lý). */
  responseStatus: number | null;
  /** Chỉ có nghĩa khi `responseStatus` khác null; `null` cũng là JSON hợp lệ. */
  response: IdempotencyJson;
}

/** Lưu kết quả theo `Idempotency-Key`; mọi method tham gia giao dịch đang mở nếu có. */
export abstract class IdempotencyStore {
  abstract find(scope: string, key: string): Promise<IdempotencyRecord | null>;
  /**
   * Chèn khoá kiểu `ON CONFLICT DO NOTHING`: trả `true` nếu lần gọi này tạo ra
   * khoá, `false` nếu `(scope, key)` đã tồn tại. Không ném lỗi unique nên không
   * làm hỏng (25P02) giao dịch đang mở; caller `find()` rồi quyết replay/409.
   */
  abstract start(scope: string, key: string, requestHash: string): Promise<boolean>;
  /**
   * Ghi kết quả cho khoá đã `start`. `response` `null` lưu JSON null. Ném `Error`
   * thường (lỗi hạ tầng, ra 500) nếu khoá chưa được `start`.
   */
  abstract complete(scope: string, key: string, status: number, response: IdempotencyJson): Promise<void>;
}
