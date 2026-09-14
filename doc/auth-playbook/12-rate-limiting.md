# 12 — Rate Limiting

> Trước khi bắt đầu, đảm bảo bạn đã làm xong [11-reset-password.md](./11-reset-password.md) — toàn bộ 10 endpoint `/auth/*` đã chạy được. Cần tra thuật ngữ nào đó thì mở [GLOSSARY.md](./GLOSSARY.md); cần nhắc lại quyết định #11 (endpoint nào cần rate limit, threshold bao nhiêu) thì xem [00-overview.md](./00-overview.md).

Giờ tất cả endpoint đã hoạt động, bước tiếp theo là giảm rủi ro spam/brute-force/enumeration trên các endpoint public-facing (quyết định #11) bằng cách giới hạn số lần gọi trong 1 khoảng thời gian. Bài này đụng tới `src/app.module.ts` (hoặc `src/auth/auth.module.ts`), `src/auth/auth.controller.ts`, và 1 file mới `src/auth/guards/email-throttler.guard.ts` — chia thành 4 bước.

> 📘 **Khái niệm — `ThrottlerGuard`/`@Throttle()` hoạt động thế nào?**
> `@nestjs/throttler` đếm số request tới 1 route trong 1 khoảng thời gian (`ttl`), theo 1 "key" nhận diện request (mặc định là IP — `req.ip`). Vượt quá `limit` request trong khoảng `ttl` đó → tự động trả `429 Too Many Requests`, code trong Controller/Service không chạy tới. Cơ chế đếm là dạng cửa sổ trượt/cố định tuỳ version package (v5+ dùng thuật toán khác v4) — không cần quan tâm chi tiết thuật toán cho MVP, chỉ cần biết: **mỗi route có thể có `ttl`/`limit` riêng qua decorator `@Throttle()`**, ghi đè lên default khai ở `ThrottlerModule.forRoot()`.
>
> ⚠️ **Mặc định tracker là IP, KHÔNG tự có per-email.** Muốn giới hạn "1 request / 60 giây / email" (như `forgot-password`/`resend-verification` bên dưới), phải tự viết 1 `Guard` kế thừa `ThrottlerGuard` và override cách sinh "tracker key" — tên method cụ thể **khác nhau giữa các major version của `@nestjs/throttler`** (`getTracker()` ở v4, cách khác ở v5+). **Chạy `npm ls @nestjs/throttler` để biết version đã cài ở [01-setup.md](./01-setup.md) (bước cài package), rồi đối chiếu lại API đúng version đó trong doc chính thức trước khi paste code override bên dưới** — code mẫu ở đây viết theo API v5 (`getTracker`/`generateKey` nhận thêm `req`), có thể cần chỉnh nếu repo cài version khác.

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

`login` chặn theo IP là đủ, nhưng `forgot-password`/`resend-verification` cần chặn theo **email** (vd để 2 IP khác nhau cùng spam 1 email vẫn bị chặn) — tracker mặc định của `@nestjs/throttler` không tự làm được việc này, bạn cần viết 1 Guard riêng kế thừa `ThrottlerGuard` và override cách sinh key:

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

---

## Bước 4 — Áp `@Throttle()` lên từng route

Giờ gắn threshold cụ thể cho từng endpoint theo quyết định #11. Các con số dưới đây là **giá trị khởi điểm để implement, không phải security guarantee cố định** — cần tune lại theo traffic thật khi lên production (theo dõi rate 429 thật, false-positive với user hợp lệ...):

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

Cú pháp tham số của `@Throttle()` (object `{ default: { limit, ttl } }` vs mảng) cũng khác nhau giữa version — đối chiếu lại theo `npm ls @nestjs/throttler` nếu code không compile.

Tự thử nghiệm để chắc mọi thứ hoạt động đúng: gọi `login` 6 lần liên tiếp trong 1 phút — lần thứ 6 phải nhận `429`. Gọi `forgot-password` 2 lần liên tiếp với cùng 1 email (kể cả giả lập đổi IP nếu test cho phép set header) — lần 2 phải nhận `429`, nhưng gọi với 2 email khác nhau liên tiếp thì cả 2 đều phải pass (không bị tính chung 1 counter — đây là điểm khẳng định tracker theo email đã hoạt động đúng, không rơi về theo IP). Cũng nên thử 1 lần login sai rồi login đúng ngay sau trong cùng phút — không được bị chặn ở threshold 5/phút, vì đó là hành vi bình thường của user thật, không phải brute-force. Cuối cùng, kiểm tra 1 route không khai `@Throttle()` riêng (vd `GET /auth/me`) vẫn áp đúng default global (20/phút/IP) — không route nào bị bỏ sót rate limit hoàn toàn.

---

➡️ Tiếp theo: [13-testing.md](./13-testing.md)
