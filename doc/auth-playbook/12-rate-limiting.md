# 12 — Rate Limiting

> Trước khi bắt đầu, đảm bảo bạn đã làm xong [11-reset-password.md](./11-reset-password.md): toàn bộ 10 endpoint `/auth/*` đã chạy được. Cần tra thuật ngữ nào đó thì mở [GLOSSARY.md](./GLOSSARY.md); cần nhắc lại quyết định #11 (endpoint nào cần rate limit, threshold bao nhiêu) thì xem [00-overview.md](./00-overview.md).

Giờ tất cả endpoint đã hoạt động, bước tiếp theo là giảm rủi ro spam/brute-force/enumeration trên các endpoint public-facing (quyết định #11) bằng cách giới hạn số lần gọi trong 1 khoảng thời gian. Bài này đụng tới `src/app.module.ts` (hoặc `src/auth/auth.module.ts`), `src/auth/auth.controller.ts`, và 1 file mới `src/auth/guards/email-throttler.guard.ts`. Chia thành 4 bước.

> 📘 **Khái niệm: `ThrottlerGuard`/`@Throttle()` hoạt động thế nào?**
> `@nestjs/throttler` đếm số request tới 1 route trong 1 khoảng thời gian (`ttl`), theo 1 "key" nhận diện request (mặc định là IP: `req.ip`). Vượt quá `limit` request trong khoảng `ttl` đó → tự động trả `429 Too Many Requests`, code trong Controller/Service không chạy tới. Cơ chế đếm là dạng cửa sổ trượt/cố định tuỳ version package (v5+ dùng thuật toán khác v4). Không cần quan tâm chi tiết thuật toán cho MVP, chỉ cần biết: **mỗi route có thể có `ttl`/`limit` riêng qua decorator `@Throttle()`**, ghi đè lên default khai ở `ThrottlerModule.forRoot()`.
>
> ⚠️ **Mặc định tracker là IP, KHÔNG tự có per-email.** Muốn giới hạn "1 request / 60 giây / email" (như `forgot-password`/`resend-verification` bên dưới), cách trực giác là viết 1 `Guard` kế thừa `ThrottlerGuard` và override cách sinh "tracker key". Nhưng cách đó khiến guard mới **cộng dồn** với guard global (Bước 2) thay vì thay thế nó (xem cảnh báo ⚠️ ở Bước 3), vì cả 2 đều đọc chung metadata theo tên throttler. Bài này viết `EmailThrottlerGuard` như 1 Guard độc lập, không kế thừa `ThrottlerGuard`, để tránh hẳn vấn đề đó: không phụ thuộc version `@nestjs/throttler` đã cài.

---

## Bước 1 — Cài package (nếu chưa)

Nếu chưa cài ở [01-setup.md](./01-setup.md), cài ngay:

```bash
npm install @nestjs/throttler
```

---

## Bước 2 — Đăng ký `ThrottlerModule` với default toàn cục

Trước khi tinh chỉnh threshold riêng cho từng route, bạn cần 1 mức mặc định áp dụng cho những route không khai `@Throttle()` riêng. Mở `src/app.module.ts`:

```ts
// src/app.module.ts
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60_000, limit: 20 }, // 20 request/phút/IP mặc định
    ]),
    // ...AuthModule, MailModule đã có
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard }, // bật global cho toàn app
  ],
})
export class AppModule {}
```

---

## Bước 3 — Custom tracker theo email

`login` chặn theo IP là đủ, nhưng `forgot-password`/`resend-verification` cần chặn theo **email** (vd để 2 IP khác nhau cùng spam 1 email vẫn bị chặn). Tracker mặc định của `@nestjs/throttler` không tự làm được việc này.

> ⚠️ **Vì sao KHÔNG kế thừa `ThrottlerGuard` cho guard này?** Guard toàn cục (Bước 2, `ThrottlerGuard` tracker IP) và 1 guard riêng gắn ở route qua `@UseGuards(...)` **CỘNG DỒN, không ghi đè nhau**. NestJS chạy cả 2 guard cho cùng 1 route. Nếu `EmailThrottlerGuard` kế thừa `ThrottlerGuard` và dùng chung throttler `'default'` (qua `@Throttle({ default: {...} })`), cả 2 guard sẽ cùng đọc chung 1 metadata đó: route bị giới hạn _đồng thời_ theo cả IP (guard global) lẫn email (guard riêng), có thể chặn nhầm (vd 2 email khác nhau, cùng IP, bị guard global chặn ở request thứ 2 dù mỗi email đều chưa vượt limit). Tách sang throttler tên riêng hay dùng `@SkipThrottle()` đều không chắc an toàn (metadata theo tên throttler được mọi Guard cùng đọc, và 1 throttler mới khai ở `forRoot()` áp dụng cho toàn bộ route trong app, không chỉ 2 route này). Cách chắc chắn không đụng nhau: viết guard này **độc lập hoàn toàn**, không kế thừa `ThrottlerGuard`, tự quản lý bộ đếm riêng, không chia sẻ bất kỳ state/metadata nào với guard global.

```ts
// src/auth/guards/email-throttler.guard.ts
import { CanActivate, ExecutionContext, Injectable, HttpException, HttpStatus } from '@nestjs/common';

const LIMIT = 1;
const TTL_MS = 60_000;

/**
 * Guard độc lập, KHÔNG kế thừa ThrottlerGuard — tự đếm request theo email
 * bằng 1 Map in-memory riêng, không đụng gì tới guard global (Bước 2) hay
 * cơ chế throttler/metadata chuẩn của @nestjs/throttler. Nhờ vậy nó không
 * thể bị cộng dồn/xung đột với guard global dù cấu hình global thay đổi
 * thế nào.
 *
 * ⚠️ Giới hạn đã biết:
 * - Map chỉ tồn tại trong bộ nhớ của 1 process — nếu app chạy nhiều
 *   instance (horizontal scaling) phía sau load balancer, mỗi instance
 *   đếm riêng, limit thực tế sẽ lỏng hơn con số khai báo (vd 3 instance ~
 *   giới hạn thực tế gần 3 lần). Chấp nhận được cho MVP; nếu cần đúng
 *   tuyệt đối khi scale nhiều instance, thay Map bằng lưu trữ dùng chung
 *   (vd Redis).
 * - Key đếm gồm CẢ route lẫn email (`${route}:${email}`), KHÔNG chỉ email
 *   — nếu chỉ dùng email làm key, guard này (dùng chung 1 instance
 *   singleton cho mọi route gắn `@UseGuards(EmailThrottlerGuard)`) sẽ đếm
 *   CHUNG 1 counter cho `forgot-password` và `resend-verification`, khiến
 *   user gọi 2 API khác nhau với cùng email trong 60s bị chặn nhầm dù mỗi
 *   API riêng lẻ chưa vượt limit.
 * - `setInterval` dọn định kỳ các entry đã hết hạn — nếu không, Map phình
 *   to dần vô hạn theo số lượng email/IP distinct đã từng gọi (rò rỉ bộ
 *   nhớ khi chạy lâu dài với traffic thật), vì entry chỉ được ghi đè khi
 *   đúng key đó có request mới, không tự bị xoá khi hết hạn mà không ai gọi lại.
 */
@Injectable()
export class EmailThrottlerGuard implements CanActivate {
  private readonly hits = new Map<string, { count: number; resetAt: number }>();

  constructor() {
    // Dọn entry hết hạn mỗi TTL_MS để Map không phình to vô hạn theo thời
    // gian. unref() để không giữ process sống chỉ vì timer này (không cản
    // graceful shutdown).
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
    // Gồm cả route trong key — 2 route khác nhau dùng chung guard này
    // (forgot-password, resend-verification) không được đếm chung 1 bucket.
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
```

---

## Bước 4 — Áp `@Throttle()` lên từng route

Giờ gắn threshold cụ thể cho từng endpoint theo quyết định #11. Các con số dưới đây là **giá trị khởi điểm để implement, không phải security guarantee cố định**, cần tune lại theo traffic thật khi lên production (theo dõi rate 429 thật, false-positive với user hợp lệ...):

```ts
// src/auth/auth.controller.ts
import { Throttle } from '@nestjs/throttler';
import { UseGuards } from '@nestjs/common';
import { EmailThrottlerGuard } from './guards/email-throttler.guard';

@Controller('auth')
export class AuthController {
  // login: 5 request / phút / IP — default tracker, không cần custom.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  async login(/* ... */) {}

  // forgot-password / resend-verification: 1 request / 60s / email — dùng
  // EmailThrottlerGuard riêng (Bước 3), guard này tự quản lý limit/ttl nội
  // bộ (không dùng @Throttle() vì nó không kế thừa ThrottlerGuard). Guard
  // global (Bước 2, 20/phút/IP) vẫn chạy song song — CỐ Ý giữ lại, đây là
  // lớp bảo vệ RỘNG bổ sung (chặn spam thô bạo từ 1 IP bất kể email), còn
  // EmailThrottlerGuard là lớp CHẶT hơn nhắm riêng theo email. 2 lớp không
  // xung đột vì độc lập hoàn toàn (xem cảnh báo ⚠️ ở Bước 3).
  @UseGuards(EmailThrottlerGuard)
  @Post('forgot-password')
  async forgotPassword(/* ... */) {}

  @UseGuards(EmailThrottlerGuard)
  @Post('resend-verification')
  async resendVerification(/* ... */) {}

  // register / verify-email / refresh: rộng hơn (chủ yếu chặn abuse, không
  // chặn UX bình thường) — default tracker theo IP.
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('register')
  async register(/* ... */) {}

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('verify-email')
  async verifyEmail(/* ... */) {}

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('refresh')
  async refresh(/* ... */) {}
}
```

Cú pháp tham số của `@Throttle()` (object `{ default: { limit, ttl } }` vs mảng) cũng khác nhau giữa version. Đối chiếu lại theo `npm ls @nestjs/throttler` nếu code không compile.

Tự thử nghiệm để chắc mọi thứ hoạt động đúng: gọi `login` 6 lần liên tiếp trong 1 phút, lần thứ 6 phải nhận `429`. Gọi `forgot-password` 2 lần liên tiếp với cùng 1 email (kể cả giả lập đổi IP nếu test cho phép set header), lần 2 phải nhận `429`. Nhưng gọi với 2 email khác nhau liên tiếp thì cả 2 đều phải pass, không bị tính chung 1 counter: đây là điểm khẳng định tracker theo email đã hoạt động đúng, không rơi về theo IP. Cũng nên thử 1 lần login sai rồi login đúng ngay sau trong cùng phút. Không được bị chặn ở threshold 5/phút, vì đó là hành vi bình thường của user thật, không phải brute-force. Cuối cùng, kiểm tra 1 route không khai `@Throttle()` riêng (vd `GET /auth/me`) vẫn áp đúng default global (20/phút/IP). Không route nào bị bỏ sót rate limit hoàn toàn.

---

➡️ Tiếp theo: [13-testing.md](./13-testing.md)
