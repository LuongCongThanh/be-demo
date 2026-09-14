# 12 — Rate Limiting

> ⬅️ Trước khi làm file này: xong [11-reset-password.md](./11-reset-password.md) (toàn bộ 10 endpoint `/auth/*` đã chạy được).
> 📚 Tham chiếu chung (Decisions, Security Rules...): [00-overview.md](./00-overview.md).

**Goal:** Giảm rủi ro spam/brute-force/enumeration trên các endpoint public-facing (quyết định #11).

**Files:** `src/app.module.ts` (hoặc `src/auth/auth.module.ts`), `src/auth/auth.controller.ts`, `src/auth/guards/email-throttler.guard.ts` (mới)

> 📘 **Khái niệm — `ThrottlerGuard`/`@Throttle()` hoạt động thế nào?**
> `@nestjs/throttler` đếm số request tới 1 route trong 1 khoảng thời gian (`ttl`), theo 1 "key" nhận diện request (mặc định là IP — `req.ip`). Vượt quá `limit` request trong khoảng `ttl` đó → tự động trả `429 Too Many Requests`, code trong Controller/Service không chạy tới. Cơ chế đếm là dạng cửa sổ trượt/cố định tuỳ version package (v5+ dùng thuật toán khác v4) — không cần quan tâm chi tiết thuật toán cho MVP, chỉ cần biết: **mỗi route có thể có `ttl`/`limit` riêng qua decorator `@Throttle()`**, ghi đè lên default khai ở `ThrottlerModule.forRoot()`.
>
> ⚠️ **Mặc định tracker là IP, KHÔNG tự có per-email.** Muốn giới hạn "1 request / 60 giây / email" (như `forgot-password`/`resend-verification` bên dưới), phải tự viết 1 `Guard` kế thừa `ThrottlerGuard` và override cách sinh "tracker key" — tên method cụ thể **khác nhau giữa các major version của `@nestjs/throttler`** (`getTracker()` ở v4, cách khác ở v5+). **Chạy `npm ls @nestjs/throttler` để biết version đã cài ở STEP 2 (01-setup.md), rồi đối chiếu lại API đúng version đó trong doc chính thức trước khi paste code override bên dưới** — code mẫu ở đây viết theo API v5 (`getTracker`/`generateKey` nhận thêm `req`), có thể cần chỉnh nếu repo cài version khác.

**Implementation:**

1. Cài package (nếu STEP 2 ở [01-setup.md](./01-setup.md) chưa cài):

   ```bash
   npm install @nestjs/throttler
   ```

2. Đăng ký `ThrottlerModule` trong `src/app.module.ts` với default toàn cục (áp dụng cho route không có `@Throttle()` riêng):

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

3. Custom tracker theo email cho `forgot-password`/`resend-verification`:

   ```ts
   // src/auth/guards/email-throttler.guard.ts
   import { Injectable } from '@nestjs/common';
   import { ThrottlerGuard, ThrottlerRequest } from '@nestjs/throttler';

   @Injectable()
   export class EmailThrottlerGuard extends ThrottlerGuard {
     // Sinh key theo email đã normalize (lowercase, trim) thay vì theo IP.
     // ⚠️ Chữ ký method/tên method chính xác phụ thuộc version @nestjs/throttler
     // đã cài — kiểm tra lại theo `npm ls @nestjs/throttler` trước khi dùng.
     protected async getTracker(req: Record<string, any>): Promise<string> {
       const email = (req.body?.email ?? '').toString().trim().toLowerCase();
       return email || req.ip; // fallback về IP nếu body chưa có email (vd lỗi validate)
     }
   }
   ```

4. Áp `@Throttle()` lên từng route theo đúng threshold ở quyết định #11 — **các số dưới đây là giá trị khởi điểm để implement, không phải security guarantee cố định**, cần tune lại theo traffic thật khi lên production (theo dõi rate 429 thật, false-positive với user hợp lệ...):

   ```ts
   // src/auth/auth.controller.ts
   import { Throttle, SkipThrottle } from '@nestjs/throttler';
   import { UseGuards } from '@nestjs/common';
   import { EmailThrottlerGuard } from './guards/email-throttler.guard';

   @Controller('auth')
   export class AuthController {
     // login: 5 request / phút / IP — default tracker, không cần custom.
     @Throttle({ default: { limit: 5, ttl: 60_000 } })
     @Post('login')
     async login(/* ... */) {}

     // forgot-password / resend-verification: 1 request / 60s / email — cần
     // custom tracker theo email, không phải theo IP.
     @UseGuards(EmailThrottlerGuard)
     @Throttle({ default: { limit: 1, ttl: 60_000 } })
     @Post('forgot-password')
     async forgotPassword(/* ... */) {}

     @UseGuards(EmailThrottlerGuard)
     @Throttle({ default: { limit: 1, ttl: 60_000 } })
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

   > Cú pháp tham số của `@Throttle()` (object `{ default: { limit, ttl } }` vs mảng) cũng khác nhau giữa version — đối chiếu lại theo `npm ls @nestjs/throttler` nếu code không compile.

**Acceptance Criteria:**

- [ ] Vượt threshold trên từng endpoint (`login`, `forgot-password`, `resend-verification`, `register`, `verify-email`, `refresh`) → 429.
- [ ] `forgot-password`/`resend-verification` giới hạn đúng theo **email** (2 IP khác nhau cùng gọi 1 email → vẫn bị chặn ở request thứ 2 trong 60s), không phải theo IP.
- [ ] Threshold không quá chặt tới mức chặn UX bình thường (vd 1 lần login sai rồi login đúng ngay sau, trong cùng phút, không bị chặn ở threshold 5/phút).
- [ ] Các route khác không khai `@Throttle()` riêng (vd `GET /auth/me`) vẫn áp default global (20/phút/IP), không bị bỏ sót rate limit hoàn toàn.

**Tests:**

- gọi `login` 6 lần liên tiếp trong 1 phút → lần thứ 6 nhận 429.
- gọi `forgot-password` 2 lần liên tiếp cùng email (khác IP giả lập nếu test cho phép set header) → lần 2 nhận 429.
- gọi `forgot-password` với 2 email khác nhau liên tiếp → cả 2 đều pass (không bị tính chung 1 counter).

---

➡️ Tiếp theo: [13-testing.md](./13-testing.md)
