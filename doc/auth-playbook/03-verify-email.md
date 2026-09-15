# 03 — Verify Email (`POST /auth/verify-email`)

> Trước khi bắt đầu, đảm bảo bạn đã làm xong [02-register.md](./02-register.md): đã có user và `EmailVerificationToken` được tạo lúc register. Tra thuật ngữ ở [GLOSSARY.md](./GLOSSARY.md). Nhắc lại quyết định thiết kế ở [00-overview.md](./00-overview.md).

Endpoint này xác thực email bằng **mã code 6 số** nhận qua mail, rồi cập nhật `User.emailVerifiedAt`. Chia thành 4 bước nhỏ.

> 📘 **Mã code trong email đến từ đâu?** Từ `02-register.md` (Bước 4), `MailService.sendVerificationEmail()` gửi thẳng mã 6 số (`rawCode`, sinh ở `TokenService`) trong nội dung mail qua SMTP (nodemailer) — hoặc chỉ log ra console nếu chưa cấu hình `SMTP_HOST/PORT/USER/PASS` (mặc định khi dev/CI, xem `.env.example`). Frontend đọc mã người dùng nhập vào form, kèm `email` họ đã đăng ký, rồi gọi `POST /auth/verify-email` với `{ email, code }` — chính là input của `VerifyEmailDto` ở Bước 1 dưới đây. Việc `RegisterDto` có thêm `fullName`/`phone` bắt buộc (xem `02-register.md` Bước 1) không ảnh hưởng gì tới flow verify-email này: code sinh ra và xác thực độc lập với 2 field đó.
>
> 📘 **Vì sao cần thêm `email` trong body, không chỉ gửi `code`?** Token cũ là chuỗi 64 ký tự hex (32 byte ngẫu nhiên) nên tự nó đủ unique để tra thẳng trong DB. Mã OTP chỉ có 6 chữ số (1 triệu khả năng) — nếu chỉ tra theo hash của code mà không ràng buộc với user nào, kẻ tấn công có thể dò ngẫu nhiên code của bất kỳ ai đang chờ verify. Bắt buộc gửi kèm `email` giúp giới hạn phạm vi: server tìm đúng user theo email trước, rồi mới so khớp code có thuộc user đó không.

## Tổng quan luồng

```
Client → POST /auth/verify-email { email: "user@example.com", code: "123456" }
                │
                ▼
       AuthController.verifyEmail(dto)
                │
                ▼
       AuthService.verifyEmail(dto)
         1. tìm User theo email
         2. tìm EmailVerificationToken đang chờ verify của user đó (theo userId)
         3. kiểm tra: không có mã chờ verify? đã dùng? hết hạn? quá số lần thử?
         4. hash(code), so khớp record.tokenHash — sai thì tăng attempts, trả lỗi
         5. transaction: User.emailVerifiedAt = now
                        + Token.verifiedAt = now
                │
                ▼
       { message: "Email verified successfully" }
```

4 bước dưới đây chỉ là 4 file/phần cần tạo để dựng luồng này: DTO input → DTO output dùng chung → logic ở service → route ở controller.

---

## Bước 1 — Mô tả dữ liệu client gửi lên (VerifyEmailDto)

Client cần gửi lên 2 thứ: `email` đã đăng ký và `code` 6 số nhận được qua mail. Tạo file `src/auth/dto/verify-email.dto.ts`:

```powershell
New-Item src/auth/dto/verify-email.dto.ts -ItemType File   # PowerShell
```

```bash
touch src/auth/dto/verify-email.dto.ts   # Bash (Git Bash/WSL)
```

```ts
// src/auth/dto/verify-email.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, Matches } from 'class-validator';

export class VerifyEmailDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: '123456', description: '6-digit code received by email' })
  @Matches(/^\d{6}$/, { message: 'code must be a 6-digit number' })
  code!: string;
}
```

**Vì sao code như vậy:**

- Có 2 field `email` + `code`, khác với token cũ chỉ cần 1 field. Mã 6 số (1 triệu khả năng) không đủ unique để tự nó định danh user an toàn như raw token 64 ký tự trước đây — cần `email` để giới hạn phạm vi tra cứu về đúng 1 user trước khi so khớp code.
- `@Matches(/^\d{6}$/)` chặn ngay ở tầng DTO nếu `code` không đúng 6 chữ số (thiếu số, có ký tự chữ...). `@IsEmail()` chặn email sai định dạng. `ValidationPipe` (global) tự áp dụng cả 2, không cần viết `if` thủ công trong service.
- `@ApiProperty()` để 2 field này hiện lên trong Swagger doc.

File này chưa gọi được route nào. Build không lỗi là xong bước này.

---

## Bước 2 — Tạo DTO response dùng chung (MessageResponseDto)

Nhiều endpoint sau này (verify-email, resend-verification, forgot-password, reset-password, logout, logout-all) đều chỉ cần trả về `{ message: string }`. Không có lý do gì để định nghĩa 6 class giống hệt nhau; xem bảng Response DTO ở [00-overview.md § 5](./00-overview.md).

> 📘 **Khái niệm: vì sao tạo 1 DTO dùng chung thay vì mỗi endpoint tự định nghĩa response riêng?** 6 endpoint khác nhau đều chỉ cần trả `{ message: string }`, không có lý do định nghĩa 6 class giống hệt nhau. Tạo 1 lần, tái sử dụng ở mọi Controller cần.

Tạo file `src/auth/dto/message-response.dto.ts`:

```powershell
New-Item src/auth/dto/message-response.dto.ts -ItemType File   # PowerShell
```

```bash
touch src/auth/dto/message-response.dto.ts   # Bash (Git Bash/WSL)
```

```ts
// src/auth/dto/message-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';

// Response dùng chung: nhiều endpoint (verify-email, logout, ...) chỉ cần
// trả về { message: "..." }, nên viết 1 class này để dùng lại thay vì
// mỗi endpoint tự tạo 1 class giống hệt nhau.
export class MessageResponseDto {
  @ApiProperty() // để Swagger UI hiển thị field này trong doc API
  message: string;
}
```

**Vì sao code như vậy:**

- Không có decorator validate (`@IsString()`...). Đây là **response DTO**, dữ liệu server tự tạo ra, khác với **input DTO** như `VerifyEmailDto` (dữ liệu client gửi lên, cần validate).
- Dùng thực tế: hàm nào trả về `{ message: 'abc' }` tự động khớp với DTO này nhờ structural typing của TypeScript. Không cần `new MessageResponseDto()`.

Đây là DTO dùng chung, chỉ cần viết đúng 1 lần ở đây. Các file sau (04-resend-verification.md, 09-logout.md, 10-forgot-password.md, 11-reset-password.md) sẽ import lại, không tạo trùng.

---

## Bước 3 — Xác thực code trong AuthService

Đây là phần logic chính: tìm user theo email, tìm mã đang chờ verify của đúng user đó, kiểm tra hết hạn/đã dùng/quá số lần thử chưa, so khớp hash, rồi cập nhật `User.emailVerifiedAt` trong 1 transaction.

> 📘 **Khái niệm: vì sao tra `EmailVerificationToken` theo `userId` thay vì theo `tokenHash` (khác với thiết kế token cũ)?** Raw token cũ (32 byte ngẫu nhiên) đủ unique để tự nó định danh: `findUnique({ where: { tokenHash } })` là đủ. Mã OTP chỉ có 6 chữ số (1 triệu khả năng) — nếu vẫn tra theo hash của code, một request gửi code sai đơn giản là "không tìm thấy row nào", server không biết đây là _lần thử sai thứ mấy của user nào_ để đếm attempts. Vì vậy phải tra theo `userId` trước (tìm mã đang chờ verify của đúng user, tối đa 1 bản ghi vì `createEmailVerificationToken()` đã xoá mã cũ khi tạo mã mới), rồi mới so khớp hash cục bộ trong code — nhờ đó dù code sai vẫn xác định được đúng "phiên verify" để tăng `attempts`.
>
> 📘 **Khái niệm: vì sao cần giới hạn `attempts` (số lần nhập sai)?** Mã 6 số chỉ có 1 triệu khả năng — nếu không giới hạn số lần thử trong 10 phút hiệu lực, kẻ tấn công hoàn toàn có thể dò (brute-force online) hết 1 triệu khả năng đó trước khi code hết hạn. Giới hạn 5 lần thử sai (`MAX_VERIFY_ATTEMPTS`) khiến việc dò mù gần như vô ích: xác suất đoán trúng trong 5 lần chỉ khoảng 5/1.000.000.
>
> 📘 **Khái niệm: vì sao trả cùng 1 lỗi `NotFoundException('Invalid email or code')` cho cả trường hợp email không tồn tại lẫn không có mã đang chờ verify?** Nếu trả lỗi khác nhau cho từng trường hợp, kẻ tấn công có thể dò được email nào đã đăng ký dựa vào thông báo lỗi khác biệt đó (enumeration attack). Gộp chung 1 thông báo để không lộ thông tin nào đúng, thông tin nào sai.
>
> 📘 **Khái niệm: vì sao update `User` + `token.verifiedAt` phải chung 1 transaction?** Nếu update `User.emailVerifiedAt` thành công nhưng update `token.verifiedAt` thất bại (crash giữa chừng), token đó vẫn còn "chưa dùng" và có thể bị verify lại lần 2. Điều này vi phạm rule "gọi lại lần 2 phải bị reject". Transaction đảm bảo cả 2 thay đổi cùng xảy ra hoặc cùng không xảy ra.
>
> 📘 **Khái niệm: vì sao không đủ nếu chỉ check `record.verifiedAt` rồi mới update — phải "claim" token bằng conditional update?** Bước `findFirst` (đọc) và bước update (ghi) là 2 thao tác tách rời, không atomic với nhau. Nếu 2 request cùng gửi đúng 1 code hợp lệ gần như đồng thời, cả 2 đều có thể đọc được `verifiedAt: null` **trước khi** request nào commit xong — cả 2 cùng vượt qua check, cùng chạy update. Đây chính là race condition (TOCTOU: time-of-check to time-of-use) phá vỡ đúng guarantee "replay protection" mà toàn bộ logic này được viết ra để đảm bảo. Cách khắc phục: đừng chỉ dựa vào giá trị đã đọc ở bước check — "giành" (claim) token bằng 1 câu update có điều kiện `verifiedAt: null` ngay trong `WHERE`, để chính DB (chứ không phải code JS) đảm bảo tính atomic. Chỉ request nào update trúng đúng 1 dòng (`count === 1`) mới được xem là thắng; request thua (`count === 0`) coi như gặp code đã dùng.

Mở `src/auth/services/auth.service.ts` (đã có từ 02-register.md) và thêm method mới:

```ts
// src/auth/services/auth.service.ts (thêm vào class AuthService đã có)
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { VerifyEmailDto } from '../dto/verify-email.dto';

// 6-digit codes only have 1,000,000 possibilities, nên phải giới hạn số lần
// thử sai, nếu không kẻ tấn công có thể dò hết trong 10 phút hiệu lực.
const MAX_VERIFY_ATTEMPTS = 5;

// ... trong class AuthService, cạnh register()

async verifyEmail(dto: VerifyEmailDto): Promise<{ message: string }> {
  // Code 6 số không đủ unique để tự định danh user (khác raw token cũ, 32
  // byte ngẫu nhiên) — tra mã đang chờ verify của đúng user theo userId
  // trước (tối đa 1 bản ghi), rồi mới so khớp hash cục bộ. Nhờ vậy 1 lần
  // đoán sai vẫn xác định được đúng bản ghi để tăng `attempts`.
  const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
  const record = user
    ? await this.prisma.emailVerificationToken.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
      })
    : null;

  if (!record) {
    // Cùng 1 lỗi dù email không tồn tại hay không có mã đang chờ verify —
    // không lộ thông tin nào đúng/sai (chống enumeration).
    throw new NotFoundException('Invalid email or code');
  }
  if (record.verifiedAt) {
    // Replay protection: code đã dùng rồi, gọi lại lần 2 phải bị reject
    // (không phải hành vi idempotent).
    throw new BadRequestException('Code already used');
  }
  if (record.expiresAt < new Date()) {
    throw new BadRequestException('Code has expired');
  }
  if (record.attempts >= MAX_VERIFY_ATTEMPTS) {
    throw new BadRequestException('Too many attempts. Request a new code.');
  }

  if (this.tokenService.hashRawToken(dto.code) !== record.tokenHash) {
    // Đếm cả lần đoán sai — đây chính là cơ chế chặn brute-force mã 6 số
    // trong thời gian hiệu lực.
    await this.prisma.emailVerificationToken.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
    });
    throw new NotFoundException('Invalid email or code');
  }

  // findFirst() ở trên không atomic với update bên dưới, nên 2 request
  // cùng code hợp lệ có thể cùng vượt qua check trước khi request nào
  // commit (race condition). "Claim" token bằng conditional update
  // (verifiedAt: null trong WHERE) để DB đảm bảo chỉ 1 request thắng.
  const wonRace = await this.prisma.$transaction(async (tx) => {
    const claimed = await tx.emailVerificationToken.updateMany({
      where: { id: record.id, verifiedAt: null },
      data: { verifiedAt: new Date() },
    });
    if (claimed.count === 0) {
      return false;
    }

    await tx.user.update({
      where: { id: record.userId },
      data: { emailVerifiedAt: new Date() },
    });
    return true;
  });

  if (!wonRace) {
    throw new BadRequestException('Code already used');
  }

  return { message: 'Email verified successfully' };
}
```

⚠️ Tên field (`emailVerificationToken`, `tokenHash`, `attempts`, `verifiedAt`, `expiresAt`, `userId`, `emailVerifiedAt`) phải khớp `prisma/schema.prisma`. Đối chiếu trước khi paste. Model `EmailVerificationToken` hiện tại (`prisma/schema.prisma`):

```prisma
model EmailVerificationToken {
  id         String    @id @default(uuid()) @db.Uuid
  userId     String    @map("user_id") @db.Uuid
  tokenHash  String    @unique @map("token_hash")
  attempts   Int       @default(0)
  expiresAt  DateTime  @map("expires_at") @db.Timestamptz(6)
  verifiedAt DateTime? @map("verified_at") @db.Timestamptz(6)
  createdAt  DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("email_verification_tokens")
}
```

**Vì sao code như vậy, theo đúng thứ tự chạy:**

| Phần code                                                                         | Việc làm                           | Vì sao                                                                                                                                |
| --------------------------------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `prisma.user.findUnique({ where: { email } })`                                    | Tìm user theo email                | Mã 6 số không đủ unique để tự định danh user an toàn, cần giới hạn phạm vi tra cứu về đúng 1 user trước.                              |
| `findFirst({ where: { userId } })`                                                | Tìm mã đang chờ verify của user    | Tối đa 1 bản ghi (mã cũ bị xoá khi tạo mã mới). Tra theo `userId`, không phải theo `tokenHash`, để đoán sai vẫn xác định được record. |
| `if (!record) throw NotFoundException`                                            | Email/không có mã chờ verify → 404 | Gộp chung 1 lỗi — chống enumeration attack.                                                                                           |
| `if (record.verifiedAt) throw BadRequestException`                                | Code đã dùng rồi → 400             | **Replay protection**: chặn gọi lại lần 2 với cùng code, không cho hành vi idempotent im lặng.                                        |
| `if (record.expiresAt < new Date()) throw BadRequestException`                    | Code hết hạn → 400                 | Giới hạn 10 phút tuổi code (ngắn vì không gian chỉ 1 triệu khả năng), set lúc tạo ở register.                                         |
| `if (record.attempts >= MAX_VERIFY_ATTEMPTS) throw BadRequestException`           | Quá số lần thử → 400               | **Brute-force protection**: chặn dò mù mã 6 số trước khi code hết hạn.                                                                |
| `hashRawToken(dto.code) !== record.tokenHash` → `update({ attempts: increment })` | Code sai → tăng attempts, 404      | Đếm cả lần đoán sai để giới hạn có tác dụng thực tế.                                                                                  |
| `tx.emailVerificationToken.updateMany({ where: { id, verifiedAt: null }, ... })`  | "Claim" token, có điều kiện        | Conditional update: chỉ thắng nếu `verifiedAt` vẫn còn `null` tại thời điểm update, đóng race window giữa `findFirst` và transaction. |
| `if (claimed.count === 0) return false`                                           | Thua race → coi như đã dùng        | Có request khác vừa claim code này trước, giữa lúc `findFirst` và transaction chạy.                                                   |
| `tx.user.update(...)`                                                             | Chỉ chạy khi thắng race            | Đặt trong cùng transaction, chỉ commit khi claim ở trên đã thành công.                                                                |

Dùng dạng callback `this.prisma.$transaction(async (tx) => {...})` thay vì dạng mảng `$transaction([...])` — khác với bản đầu tiên của method này. Lý do: giờ bước thứ 2 (`tx.user.update`) _phụ thuộc kết quả_ của bước thứ nhất (`claimed.count`), nên không thể dùng dạng mảng (mảng chạy tất cả các Promise vô điều kiện, không có chỗ để rẽ nhánh dựa trên kết quả bước trước — xem đúng tiêu chí phân biệt 2 dạng transaction đã nêu ở 02-register.md).

Thử nghiệm: gọi `verifyEmail` với email+code hợp lệ phải thành công. Gọi lại lần 2 với đúng code đó phải nhận `BadRequestException` (đã verified), không phải hành vi idempotent im lặng. Email không tồn tại hoặc không có mã chờ verify → `NotFoundException`. Code hết hạn (sau 10 phút) → `BadRequestException`. Nhập sai 5 lần → lần thứ 6 (dù đúng code) vẫn nhận `BadRequestException`. Gọi 2 request gần như đồng thời cùng 1 code hợp lệ: đúng 1 request thành công, request còn lại nhận `BadRequestException` (không có trường hợp cả 2 cùng thành công).

---

## Bước 4 — Mở endpoint HTTP

Bước cuối, expose route `POST /auth/verify-email`:

```ts
// src/auth/auth.controller.ts (thêm vào class AuthController đã có ở 02-register.md)
import { VerifyEmailDto } from './dto/verify-email.dto';
import { MessageResponseDto } from './dto/message-response.dto';

// ... trong class AuthController, cạnh register()

@Post('verify-email')
@HttpCode(HttpStatus.OK)
async verifyEmail(@Body() dto: VerifyEmailDto): Promise<MessageResponseDto> {
  return this.authService.verifyEmail(dto);
}
```

**Vì sao code như vậy:**

- `@Post('verify-email')` mở route `POST /auth/verify-email`.
- `@HttpCode(HttpStatus.OK)` ép trả về 200 thay vì mặc định 201 mà NestJS tự gán cho mọi `@Post`. Verify-email không tạo resource mới, 200 mới đúng nghĩa REST.
- `@Body() dto: VerifyEmailDto`: NestJS tự parse JSON body và chạy `ValidationPipe` trên `VerifyEmailDto` trước khi vào hàm.
- Controller không xử lý logic gì, chỉ forward `dto` xuống `authService.verifyEmail(dto)`. Giữ đúng nguyên tắc controller mỏng, logic nghiệp vụ nằm ở service.

Gọi thử qua Postman/curl để tự xác nhận toàn bộ flow (Bước 1 → 4): email+code hợp lệ verify thành công; gọi lại lần 2 nhận lỗi đã verified; email không tồn tại/code sai nhận 404; code hết hạn nhận 400. Khi viết test chính thức ở [13-testing.md](./13-testing.md), nhớ cover đủ các case trên. Case "verify code đã dùng rồi" (replay protection) hay bị bỏ sót nhất: gọi lại lần 2 với code đã verified phải bị reject, không phải hành vi idempotent.

### Trace nhanh 1 request thực tế

Giả sử body gửi lên: `{ "email": "user@example.com", "code": "394821" }` (code client nhận qua mail, được tạo lúc `register()`, xem `01-setup.md` phần `TokenService`).

1. `ValidationPipe` validate `dto = { email: "user@example.com", code: "394821" }` rồi cho vào tới Controller.
2. Controller forward `dto` xuống `authService.verifyEmail(dto)`.
3. Service tìm `user` theo `email`, ra đúng `userId`.
4. `findFirst` tìm ra `record` — mã đang chờ verify của đúng user đó (giả sử còn hạn, chưa verify, `attempts` chưa đạt giới hạn).
5. Service hash lại `"394821"`, so khớp với `record.tokenHash` — trùng khớp.
6. Transaction: `updateMany` claim token (điều kiện `verifiedAt: null`) thành công (`count = 1`), rồi update `User.emailVerifiedAt`.
7. Trả `{ message: 'Email verified successfully' }`, Controller trả HTTP 200.

Nếu gọi lại với code sai: `findFirst` vẫn tìm ra đúng `record` đó (chưa verify), nhưng hash không khớp `record.tokenHash` → tăng `record.attempts` lên 1, trả `NotFoundException('Invalid email or code')`, không chạm transaction. Lặp lại đủ `MAX_VERIFY_ATTEMPTS` (5) lần sai thì lần gọi kế tiếp — kể cả gửi đúng code — sẽ bị chặn ở bước `attempts >= MAX_VERIFY_ATTEMPTS` với `BadRequestException`.

Nếu gọi lại lần 2 với đúng email+code (sau khi đã verify thành công): `findFirst` vẫn tìm ra `record` (token không bị xoá, chỉ bị đánh dấu). `record.verifiedAt` giờ đã có giá trị nên rơi vào nhánh `BadRequestException('Code already used')` ngay ở bước check, không chạm transaction nữa.

Nếu 2 request cùng gửi đúng 1 email+code gần như đồng thời (race): cả 2 đều có thể đọc `record.verifiedAt = null` ở bước `findFirst` (chưa request nào commit). Nhưng khi vào tới transaction, chỉ 1 request `updateMany` trúng đúng 1 dòng (`count = 1`) vì request kia đã claim trước; request thua nhận `claimed.count === 0` → `BadRequestException('Code already used')`, và **không** chạm tới `tx.user.update`.

---

➡️ Tiếp theo: [04-resend-verification.md](./04-resend-verification.md)
