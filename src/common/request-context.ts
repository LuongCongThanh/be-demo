import { AsyncLocalStorage } from 'node:async_hooks';

interface RequestStore {
  requestId: string;
}

const storage = new AsyncLocalStorage<RequestStore>();

// Dùng AsyncLocalStorage (built-in Node) để mọi nơi trong request pipeline
// (service, filter, logger) đọc được requestId mà không cần truyền tay qua
// từng tham số hàm — xem doc/error-logging-conventions.md.
export const RequestContext = {
  run<T>(requestId: string, callback: () => T): T {
    return storage.run({ requestId }, callback);
  },

  getRequestId(): string | undefined {
    return storage.getStore()?.requestId;
  },
};
