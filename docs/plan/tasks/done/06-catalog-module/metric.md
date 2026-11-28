# Metric 06: Gộp catalog thành một module

Đo ngày 2026-11-06. "Trước" = `ed45eec` (dev), "Sau" = `451ed2d` (`chore/catalog-module`).

## Hành vi (bằng chứng pure move)

| Chỉ số                                | Trước            | Sau                           |
| ------------------------------------- | ---------------- | ----------------------------- |
| Folder catalog dưới `src/`            | 3                | 1 (`modules/catalog/`)        |
| Nest module catalog                   | 3                | 1                             |
| `imports: [AuthModule]` trong catalog | 3                | 1                             |
| Số file `*.spec.ts` trong `src/`      | 30               | 30                            |
| Unit test pass                        | 233              | 233                           |
| E2E test pass                         | 175 (+1 skipped) | 175 (+1 skipped)              |
| Swagger path                          | 41               | 41                            |
| Swagger diff (`jq -S`)                | —                | **rỗng** (70 699 byte cả hai) |
| AC3 grep đường dẫn cũ                 | —                | 0 kết quả                     |
| `lint` / `typecheck`                  | —                | xanh                          |

## Code

| Chỉ số                                  | Giá trị                            |
| --------------------------------------- | ---------------------------------- |
| File `src/` + `test/` đổi               | 72 (+153 / −155 dòng)              |
| Trong đó rename (`git diff -M`)         | 60 R · 6 M · 3 A · 3 D             |
| File `.ts` trong `modules/catalog/`     | 57                                 |
| Dòng code non-spec / spec trong catalog | 1 798 / 1 166                      |
| Logic / assertion bị sửa                | 0                                  |
| Tỉ lệ code chạy tốt (test pass)         | 408/408 (100 %), 1 e2e skip sẵn có |

## Bước 2: gom controller vào `controllers/`

| Chỉ số                    | Giá trị                                   |
| ------------------------- | ----------------------------------------- |
| File controller di chuyển | 6 (`git mv`, 0 dòng logic)                |
| File sửa import           | `catalog.module.ts` + spec liên quan      |
| Docs convention sửa       | `coding-style §2.2/§2.6`, `02-modules §4` |
| Unit / e2e                | 233/233 · 175 (+1 skip)                   |
| Swagger diff `jq -S`      | rỗng                                      |
| ADR sửa                   | 0 (không ADR nào mô tả layout)            |

## Token (Claude Code, ước lượng)

Agent không đọc được bộ đếm token thật; số dưới là ước lượng từ lượng context đã nạp. Số chính xác: xem `/cost` hoặc usage dashboard.

| Phiên                             | Ước lượng               |
| --------------------------------- | ----------------------- |
| Di chuyển file (commit `ad5cc32`) | không đo (phiên trước)  |
| Verify AC + Swagger diff + metric | ~35k input / ~3k output |
| Grill + gom `controllers/` + docs | ~30k input / ~8k output |
