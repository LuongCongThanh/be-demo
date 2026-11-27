import type { Prisma } from '#src/generated/prisma/client.js';

export interface TransactionOptions {
  isolationLevel?: Prisma.TransactionIsolationLevel;
  /** Thời gian tối đa (ms) của giao dịch; mặc định của Prisma là 5000. */
  timeout?: number;
  /** Thời gian tối đa (ms) chờ lấy kết nối; mặc định của Prisma là 2000. */
  maxWait?: number;
}

/**
 * Port mở giao dịch cho `application/`. Port và adapter Prisma tự tham gia giao
 * dịch đang mở. `run()` lồng nhau nhập vào giao dịch ngoài và bỏ qua `opts`;
 * nơi gọi `run()` ngoài cùng tự retry khi gặp `P2034`.
 */
export abstract class TransactionRunner {
  abstract run<T>(work: () => Promise<T>, opts?: TransactionOptions): Promise<T>;
}
