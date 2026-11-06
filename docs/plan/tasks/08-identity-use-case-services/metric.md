# Metric 08: Tách `AuthService` theo use case

Điền khi thực hiện.

| Chỉ số                                         | Trước | Sau |
| ---------------------------------------------- | ----- | --- |
| Dòng `auth.service.ts`                         | 488   |     |
| Dòng `auth.service.spec.ts`                    | 823   |     |
| Service dài nhất trong `services/auth/` (dòng) | 488   |     |
| Spec dài nhất (dòng)                           | 823   |     |
| Dependency inject nhiều nhất / service         | 5     |     |
| Unit test pass                                 |       |     |
| E2E test pass                                  |       |     |
| Swagger diff (`jq -S`)                         | —     |     |
| Assertion bị sửa                               | —     | 0   |

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
