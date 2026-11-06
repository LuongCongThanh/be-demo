# Metric 07: Gộp `auth` + `staff` thành module identity

"Trước" = `dev` sau khi merge 06. "Sau" = HEAD của `chore/identity-module`. Điền khi thực hiện.

## Hành vi (bằng chứng thuần di chuyển)

| Chỉ số                                        | Trước | Sau |
| --------------------------------------------- | ----- | --- |
| Folder identity dưới `src/`                   | 2     |     |
| Nest module (`AuthModule`, `StaffModule`)     | 2     |     |
| Import vào bên trong `auth/services` từ ngoài | 4     |     |
| Số file `*.spec.ts` trong `src/`              |       |     |
| Unit test pass                                |       |     |
| E2E test pass                                 |       |     |
| Swagger path                                  |       |     |
| Swagger diff (`jq -S`)                        | —     |     |
| Grep AC3                                      | —     |     |
| `lint` / `typecheck`                          | —     |     |

## Code

| Chỉ số                        | Giá trị |
| ----------------------------- | ------- |
| File đổi (`git diff --stat`)  |         |
| R / M / A / D (`git diff -M`) |         |
| Logic / assertion bị sửa      | 0       |

## Token (đo thật)

Đo bằng `npm run tokens -- <sessionId> [--since <ISO>] --md`; script đọc `usage` từ transcript Claude Code, gồm cả subagent. Output token được chia theo file mà message đó ghi: `code` = `src/` (không tính spec), `test` = spec/`test/`, `docs` = `.md`/`docs/`, `other` = script/config. Message không ghi file nào thì tính vào `explore/chat`.

### Phiên grill + viết docs 07/08 (`9ceecdea`, 2026-11-07)

Phiên này viết docs cho cả 07 và 08. Dòng `other` là token để viết chính `scripts/token-usage.ts`.

| Loại         | Messages | Input | Cache write | Cache read | Output |
| ------------ | -------- | ----- | ----------- | ---------- | ------ |
| code         | 0        | 0     | 0           | 0          | 0      |
| test         | 0        | 0     | 0           | 0          | 0      |
| docs         | 2        | 4     | 7,144       | 156,642    | 10,780 |
| other        | 2        | 4     | 3,571       | 201,166    | 4,119  |
| explore/chat | 17       | 42    | 67,698      | 1,178,071  | 8,211  |
| TOTAL        | 21       | 50    | 78,413      | 1,535,879  | 23,110 |

### Phiên implement

Điền bảng từ `npm run tokens -- <sessionId> --md` sau khi xong.
