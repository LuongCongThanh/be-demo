import { CanActivate, ExecutionContext, Injectable, HttpException, HttpStatus } from '@nestjs/common';

const LIMIT = 1;
const TTL_MS = 60_000;

/**
 * Guard độc lập, KHÔNG kế thừa ThrottlerGuard — tự đếm request theo email
 * bằng 1 Map in-memory riêng, không đụng gì tới guard global hay cơ chế
 * throttler/metadata chuẩn của @nestjs/throttler (xem 12-rate-limiting.md,
 * cảnh báo ⚠️ ở Bước 3: kế thừa ThrottlerGuard sẽ khiến 2 guard cộng dồn
 * chung metadata thay vì độc lập).
 *
 * ⚠️ Giới hạn đã biết:
 * - Map chỉ tồn tại trong bộ nhớ của 1 process — nhiều instance (horizontal
 *   scaling) sẽ đếm riêng, limit thực tế lỏng hơn con số khai báo. Chấp
 *   nhận được cho MVP.
 * - Key đếm gồm CẢ route lẫn email (`${route}:${email}`), KHÔNG chỉ email —
 *   guard này dùng chung 1 instance singleton cho mọi route gắn
 *   `@UseGuards(EmailThrottlerGuard)`, nên chỉ dùng email làm key sẽ đếm
 *   CHUNG 1 counter cho forgot-password và resend-verification.
 * - `setInterval` dọn định kỳ entry hết hạn để Map không phình to vô hạn.
 */
@Injectable()
export class EmailThrottlerGuard implements CanActivate {
  private readonly hits = new Map<string, { count: number; resetAt: number }>();

  constructor() {
    // unref() để không giữ process sống chỉ vì timer này (không cản graceful shutdown).
    setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.hits) {
        if (entry.resetAt <= now) this.hits.delete(key);
      }
    }, TTL_MS).unref();
  }

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Record<string, any>>();
    const email = (req.body?.email ?? '').toString().trim().toLowerCase();
    const route = req.route?.path ?? req.url;
    const key = `${route}:${email || req.ip}`; // fallback IP nếu body chưa có email

    const now = Date.now();
    const entry = this.hits.get(key);

    if (!entry || entry.resetAt <= now) {
      this.hits.set(key, { count: 1, resetAt: now + TTL_MS });
      return true;
    }

    if (entry.count >= LIMIT) {
      throw new HttpException('Too many requests', HttpStatus.TOO_MANY_REQUESTS);
    }

    entry.count += 1;
    return true;
  }
}
