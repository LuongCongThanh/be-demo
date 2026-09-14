# 14 — Swagger/OpenAPI + Đồng bộ doc + Quality Check cuối

> ⬅️ Trước khi làm file này: xong [13-testing.md](./13-testing.md) (toàn bộ endpoint đã có test pass).
> 📚 Tham chiếu chung: [00-overview.md](./00-overview.md).

**Goal:** Toàn bộ endpoint `/auth/*` có Swagger doc đúng contract; `doc/module-auth.md` đồng bộ lại với playbook này; code sạch trước khi mở PR.

---

## Swagger/OpenAPI

**Files:** mọi DTO trong `src/auth/dto/`, `src/main.ts`

> 📘 **Khái niệm — `@nestjs/swagger` tự sinh doc từ decorator như thế nào?** `@nestjs/swagger` đọc metadata từ các decorator đã gắn sẵn trong lúc code (`@ApiProperty()` trên field DTO, `@ApiTags()` trên Controller, `@ApiOperation()`/`@ApiResponse()` trên method route) để build ra 1 file OpenAPI spec (`JSON`), rồi `SwaggerModule` render spec đó thành UI tương tác (`/api` hoặc path tuỳ cấu hình). Nghĩa là **doc luôn khớp với code thật** (miễn decorator được gắn đúng) — không cần viết doc riêng tay dễ bị lệch.

**Implementation:**

1. Nếu `main.ts` chưa bật Swagger, thêm:

   ```ts
   // src/main.ts
   import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

   async function bootstrap() {
     const app = await NestFactory.create(AppModule);
     // ...cấu hình có sẵn (ValidationPipe, CORS...)

     const config = new DocumentBuilder()
       .setTitle('Ecommerce API')
       .setDescription('Auth & Authorization MVP')
       .setVersion('1.0')
       .addBearerAuth() // để Swagger UI cho phép nhập access token, test route có JwtAuthGuard
       .build();
     const document = SwaggerModule.createDocument(app, config);
     SwaggerModule.setup('api', app, document); // UI tại http://localhost:<port>/api

     await app.listen(process.env.PORT ?? 3000);
   }
   ```

2. Thêm `@ApiOperation`/`@ApiResponse` cho từng route (ví dụ 1 route mẫu — làm tương tự cho toàn bộ 10 route `/auth/*`):

   ```ts
   // src/auth/auth.controller.ts
   import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

   @ApiTags('auth')
   @Controller('auth')
   export class AuthController {
     @ApiOperation({ summary: 'Đăng ký tài khoản CUSTOMER mới' })
     @ApiResponse({ status: 201, type: RegisterResponseDto })
     @ApiResponse({ status: 409, description: 'Email đã tồn tại' })
     @ApiResponse({ status: 400, description: 'Input không hợp lệ' })
     @Post('register')
     async register(@Body() dto: RegisterDto) {
       /* ... */
     }
   }
   ```

3. Kiểm tra toàn bộ DTO (request + response) đều có `@ApiProperty()` trên mỗi field public — thiếu decorator này thì field vẫn hoạt động đúng lúc runtime nhưng **không hiện trong Swagger schema**, dễ gây lệch giữa doc và code thật mà không ai nhận ra.

**CLI:**

```bash
npm run start:dev
# mở http://localhost:<port>/api (hoặc path Swagger đã cấu hình trong main.ts) để kiểm tra
```

**Acceptance Criteria:**

- [ ] Mọi endpoint `/auth/*` xuất hiện trong Swagger UI với request/response schema đúng.
- [ ] Route có `JwtAuthGuard` (`/auth/me`, `/auth/logout`, `/auth/logout-all`) hiện đúng yêu cầu Bearer token trong Swagger UI (nhờ `addBearerAuth()`).

---

## Đồng bộ `doc/module-auth.md`

⚠️ **Ghi chú audit quan trọng — đọc trước khi sửa gì:** `doc/module-auth.md` có thể đang ở trạng thái git rối (bản **staged là file rỗng**, còn nội dung đầy đủ nằm ở **working tree, chưa stage**). Nếu commit ngay lúc này có thể commit nhầm file rỗng và mất nội dung — cần `git add doc/module-auth.md` lại (sau khi đã sửa theo checklist dưới) trước khi commit. **Không tự ý chạy lệnh git thay đổi staging (`git reset`, `git checkout --`...) nếu chưa chắc chắn nội dung nào là bản đúng cần giữ** — nếu nghi ngờ, dừng lại và hỏi trước khi chạy lệnh git có thể mất dữ liệu.

**Implementation — cập nhật `doc/module-auth.md`:**

- [ ] Bảng API tổng kết (mục 26) có đủ dòng `POST /auth/logout-all` — kiểm tra lại, có thể đã có sẵn từ trước (không phải do bước này), không cần sửa nếu đã đúng.
- [ ] Bổ sung đoạn mô tả reuse detection (và giới hạn access-token không bị revoke ngay) vào mục liên quan tới refresh token.
- [ ] Bổ sung đoạn admin bootstrap (mục mới, mô tả seed script tạo ADMIN — không có endpoint HTTP tạo ADMIN).
- [ ] Làm rõ 2 trục trạng thái (Account status vs Email verification) ở mục mô tả User — tránh gộp mơ hồ như bản gốc.
- [ ] Ghi rõ password policy cụ thể (hoa/thường/số/ký tự đặc biệt, ≥ 8 ký tự) ở mục liên quan tới Register/Reset Password.
- [ ] Ghi chú Ownership check dùng guard/decorator dùng chung (`OwnershipGuard`) ở mục nói về authorization.

**CLI — quality check cuối:**

```bash
npm run lint
npm run format
npm run build
```

**Acceptance Criteria:**

- [ ] `npm run lint` pass, không có warning bị ignore không rõ lý do.
- [ ] `npm run format` (hoặc format check) pass.
- [ ] `npm run build` pass.
- [ ] `doc/module-auth.md` đã đồng bộ đủ 6 mục checklist trên và đã `git add` lại đúng nội dung (không phải file rỗng).
- [ ] Toàn bộ checklist còn lại (test coverage, không leak secret trong log, error envelope chung, PR reviewed...) — xem đầy đủ ở [00-overview.md § 9. Definition of Done](./00-overview.md) trước khi mở PR, không lặp lại toàn bộ ở đây để tránh 2 nơi lệch nhau khi checklist đổi.

---

🎉 Auth MVP hoàn thành — xem checklist đầy đủ ở [00-overview.md § Definition of Done](./00-overview.md) trước khi mở PR.
