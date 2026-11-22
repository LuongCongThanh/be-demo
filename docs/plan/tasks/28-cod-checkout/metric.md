# Metric 28: Tính thử và đặt đơn COD

## Kết quả kiểm thử và build

| Chỉ số                             |                      Kết quả |
| ---------------------------------- | ---------------------------: |
| Checkout unit test                 |                   12/12 pass |
| Checkout e2e test (PostgreSQL)     |                     4/4 pass |
| Unit suite toàn repo               |    315 tests / 45 files pass |
| Prisma migrations                  | 21 applied; schema diff rỗng |
| Typecheck / lint / build / OpenAPI |                         pass |

Lint vẫn in một warning đã có từ trước tại `src/modules/identity/auth/guards/email-throttler.guard.ts`; không có warning checkout.

## Token (đo bằng script)

Lệnh: `npm run tokens -- latest --md`
Session: `d09cce61-19a1-4f9f-b922-aa738277b5a7`

| Loại         | Messages |   Input | Cache write |    Cache read |     Output |
| ------------ | -------: | ------: | ----------: | ------------: | ---------: |
| code         |        1 |       2 |         700 |       128,652 |        726 |
| test         |        0 |       0 |           0 |             0 |          0 |
| docs         |        1 |       2 |         211 |       148,781 |      3,806 |
| other        |        1 |       2 |         391 |       114,266 |      2,365 |
| explore/chat |       44 |     120 |     346,185 |     5,330,243 |     20,980 |
| **TOTAL**    |   **47** | **126** | **347,487** | **5,721,942** | **27,877** |
