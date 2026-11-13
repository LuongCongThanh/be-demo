# Metric 08: Tách `AuthService` theo use case

Số liệu đo trên worktree sạch từ `origin/dev` (trước) và nhánh task (sau). E2E "trước" chưa chạy riêng; "sau" chạy trên Postgres 17 + Redis dựng bằng Docker.

| Chỉ số                                         | Trước           | Sau                                  |
| ---------------------------------------------- | --------------- | ------------------------------------ |
| Dòng `auth.service.ts`                         | 488             | 0 (đã xoá)                           |
| Dòng `auth.service.spec.ts`                    | 823             | 0 (đã xoá)                           |
| Service dài nhất trong `services/auth/` (dòng) | 488             | 202 (`registration.service.ts`)      |
| Spec dài nhất (dòng)                           | 823             | 391 (`registration.service.spec.ts`) |
| Dependency inject nhiều nhất / service         | 5               | 4                                    |
| Unit test pass                                 | 240             | 240                                  |
| E2E test pass                                  | 175 (1 skipped) | 175 (1 skipped)                      |
| Swagger diff (`jq -S`)                         | —               | rỗng                                 |
| Assertion bị sửa                               | —               | 0                                    |

## Token (đo thật)

Đo bằng `npm run tokens -- <sessionId> [--since <ISO>] --md`; cách chia loại xem [metric 07](../07-identity-module/metric.md#token-đo-thật). Token viết spec của task này nằm trong phiên `9ceecdea`, đã ghi ở metric 07.

| Loại         | Messages | Input | Cache write | Cache read | Output |
| ------------ | -------- | ----- | ----------- | ---------- | ------ |
| code         |          |       |             |            |        |
| test         |          |       |             |            |        |
| docs         |          |       |             |            |        |
| other        |          |       |             |            |        |
| explore/chat |          |       |             |            |        |
| TOTAL        |          |       |             |            |        |

Token không đo trong lượt này (người thực hiện không chạy `npm run tokens`).
