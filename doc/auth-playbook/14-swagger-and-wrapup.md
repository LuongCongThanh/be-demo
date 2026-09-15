# 14 — Swagger/OpenAPI + Đồng bộ doc + Quality Check cuối

> Trước khi bắt đầu, đảm bảo bạn đã làm xong [13-testing.md](./13-testing.md): toàn bộ endpoint đã có test pass. Tham chiếu chung: [00-overview.md](./00-overview.md).

Đây là file cuối cùng của cả playbook Auth. Còn 2 việc trước khi mở PR: cho toàn bộ endpoint `/auth/*` có Swagger doc đúng contract, và đồng bộ lại `doc/module-auth.md` với những gì bạn vừa xây xong.

---

## Bước 1 — Swagger/OpenAPI

Các file liên quan: mọi DTO trong `src/auth/dto/`, và `src/main.ts`.

> 📘 **Khái niệm: `@nestjs/swagger` tự sinh doc từ decorator như thế nào?** `@nestjs/swagger` đọc metadata từ các decorator đã gắn sẵn trong lúc code (`@ApiProperty()` trên field DTO, `@ApiTags()` trên Controller, `@ApiOperation()`/`@ApiResponse()` trên method route) để build ra 1 file OpenAPI spec (`JSON`), rồi `SwaggerModule` render spec đó thành UI tương tác (`/api` hoặc path tuỳ cấu hình). Nghĩa là **doc luôn khớp với code thật** (miễn decorator được gắn đúng). Không cần viết doc riêng tay dễ bị lệch.

Nếu `main.ts` chưa bật Swagger, thêm vào:

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

Sau đó thêm `@ApiOperation`/`@ApiResponse` cho từng route. Ví dụ 1 route mẫu, làm tương tự cho toàn bộ 10 route `/auth/*`:

```ts
// src/auth/auth.controller.ts
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  @ApiOperation({ summary: 'Register a new CUSTOMER account' })
  @ApiResponse({ status: 201, type: RegisterResponseDto })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    /* ... */
  }
}
```

Đi qua lại toàn bộ DTO (request lẫn response) và kiểm tra mỗi field public đều có `@ApiProperty()`. Thiếu decorator này thì field vẫn hoạt động đúng lúc runtime, nhưng **không hiện trong Swagger schema**. Lỗi này dễ gây lệch giữa doc và code thật mà không ai nhận ra cho tới khi có người report bug.

Chạy thử để xem kết quả:

```bash
npm run start:dev
# mở http://localhost:<port>/api (hoặc path Swagger đã cấu hình trong main.ts) để kiểm tra
```

Kiểm tra 2 điều: mọi endpoint `/auth/*` phải xuất hiện trong Swagger UI với đúng request/response schema, và route nào có `JwtAuthGuard` (`/auth/me`, `/auth/logout`, `/auth/logout-all`) phải hiện đúng yêu cầu Bearer token trong Swagger UI nhờ `addBearerAuth()` đã thêm ở trên.

---

## Bước 2 — Đồng bộ `doc/module-auth.md` và kiểm tra chất lượng cuối

⚠️ **Ghi chú audit quan trọng, đọc trước khi sửa gì:** `doc/module-auth.md` có thể đang ở trạng thái git rối (bản staged là file rỗng, còn nội dung đầy đủ nằm ở working tree, chưa stage). Nếu commit ngay lúc này có thể commit nhầm file rỗng và mất nội dung. Cần `git add doc/module-auth.md` lại (sau khi đã sửa theo danh sách dưới) trước khi commit. **Không tự ý chạy lệnh git thay đổi staging** (`git reset`, `git checkout --`...) nếu chưa chắc chắn nội dung nào là bản đúng cần giữ. Nếu nghi ngờ, dừng lại và hỏi trước khi chạy lệnh git có thể mất dữ liệu.

Cập nhật `doc/module-auth.md` theo danh sách sau:

- Bảng API tổng kết (mục 4) có đủ dòng `POST /auth/logout-all`. Kiểm tra lại, có thể đã có sẵn từ trước (không phải do bước này), không cần sửa nếu đã đúng.
- Bổ sung đoạn mô tả reuse detection (và giới hạn access-token không bị revoke ngay) vào mục liên quan tới refresh token.
- Bổ sung đoạn admin bootstrap (mục mới, mô tả seed script tạo ADMIN; không có endpoint HTTP tạo ADMIN).
- Làm rõ 2 trục trạng thái (Account status vs Email verification) ở mục mô tả User, tránh gộp mơ hồ như bản gốc.
- Ghi rõ password policy cụ thể (hoa/thường/số/ký tự đặc biệt, ≥ 8 ký tự) ở mục liên quan tới Register/Reset Password.
- Ghi chú Ownership check dùng guard/decorator dùng chung (`OwnershipGuard`) ở mục nói về authorization.

Rồi chạy quality check cuối cùng trước khi mở PR:

```bash
npm run lint
npm run format
npm run build
```

Coi toàn bộ playbook là xong khi: `npm run lint` pass không có warning bị ignore mà không rõ lý do; `npm run format` (hoặc format check) pass; `npm run build` pass; `doc/module-auth.md` đã đồng bộ đủ 6 mục ở trên và đã `git add` lại đúng nội dung (không phải file rỗng). Phần checklist tổng còn lại (test coverage, không leak secret trong log, error envelope chung, PR reviewed...) không lặp lại ở đây để tránh 2 nơi lệch nhau khi checklist đổi. Xem đầy đủ ở [00-overview.md § Definition of Done](./00-overview.md) và rà lại lần cuối trước khi mở PR.

---

🎉 Auth MVP hoàn thành. Xem checklist đầy đủ ở [00-overview.md § Definition of Done](./00-overview.md) trước khi mở PR.
