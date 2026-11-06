# Metric 07: Gộp `auth` + `staff` thành module identity

"Trước" = `dev` sau khi merge 06. "Sau" = HEAD của `chore/identity-module`. Điền khi thực hiện.

## Hành vi (bằng chứng thuần di chuyển)

| Chỉ số                                        | Trước        | Sau |
| --------------------------------------------- | ------------ | --- |
| Folder identity dưới `src/`                   | 2            |     |
| Nest module (`AuthModule`, `StaffModule`)     | 2            |     |
| Import vào bên trong `auth/services` từ ngoài | 22 (18 file) |     |
| Số file `*.spec.ts` trong `src/`              |              |     |
| Unit test pass                                |              |     |
| E2E test pass                                 |              |     |
| Swagger path                                  |              |     |
| Swagger diff (`jq -S`)                        | —            |     |
| Grep AC3                                      | —            |     |
| `lint` / `typecheck`                          | —            |     |

## Code

| Chỉ số                        | Giá trị |
| ----------------------------- | ------- |
| File đổi (`git diff --stat`)  |         |
| R / M / A / D (`git diff -M`) |         |
| Logic / assertion bị sửa      | 0       |

## Token (đo thật)

Đo bằng `npm run tokens -- <sessionId> [--since <ISO>] --md`; script đọc `usage` từ transcript Claude Code, gồm cả subagent. Output token được chia theo file mà message đó ghi: `code` = `src/` (không tính spec), `test` = spec/`test/`, `docs` = `.md`/`docs/`, `other` = script/config. Message không ghi file nào thì tính vào `explore/chat`.

### Phiên grill + viết docs 07/08 (`9ceecdea`, đến commit `f2a56de`)

`npm run tokens -- 9ceecdea --until 2026-11-06T17:28:18 --md` (mốc UTC = lúc commit docs). Phiên này viết docs cho cả 07 và 08; dòng `other` là token viết chính `scripts/token-usage.ts`. Số đã đo lại sau khi script giữ `usage` của dòng cuối mỗi message.

| Loại         | Messages | Input | Cache write | Cache read | Output |
| ------------ | -------- | ----- | ----------- | ---------- | ------ |
| code         | 0        | 0     | 0           | 0          | 0      |
| test         | 0        | 0     | 0           | 0          | 0      |
| docs         | 3        | 6     | 7,889       | 262,415    | 12,300 |
| other        | 2        | 4     | 3,571       | 201,166    | 4,119  |
| explore/chat | 24       | 58    | 77,786      | 1,949,861  | 11,314 |
| TOTAL        | 29       | 68    | 89,246      | 2,413,442  | 27,733 |

### Phiên review + sửa trước PR

`npm run tokens -- 9ceecdea --since 2026-11-06T17:28:18 --md`, gồm 2 reviewer (sub-agent) và phần sửa docs/script.

| Loại         | Messages | Input | Cache write | Cache read | Output |
| ------------ | -------- | ----- | ----------- | ---------- | ------ |
| explore/chat | 27       | 64    | 151,366     | 2,584,173  | 22,302 |
| TOTAL        | 27       | 64    | 151,366     | 2,584,173  | 22,302 |

Giới hạn: phần sửa ở phiên này làm bằng lệnh Bash (python/sed), không qua Write/Edit, nên script không biết file nào được ghi và xếp cả vào `explore/chat`. Muốn số chia đúng loại thì sửa file bằng Write/Edit.

### Phiên implement

Điền bảng từ `npm run tokens -- <sessionId> --md` sau khi xong.
