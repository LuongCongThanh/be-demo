# Metric 06: Gộp catalog thành một module

| Chỉ số                                | Trước            | Sau                                         |
| ------------------------------------- | ---------------- | ------------------------------------------- |
| Folder catalog dưới `src/`            | 3                | 1 (`modules/catalog/`)                      |
| Nest module catalog                   | 3                | 1                                           |
| `imports: [AuthModule]` trong catalog | 3                | 1                                           |
| Số file `*.spec.ts` trong `src/`      | 30               | 30                                          |
| Unit test pass                        | 233              | 233                                         |
| E2E test pass                         | 175 (+1 skipped) | 175 (+1 skipped)                            |
| Swagger diff (`jq -S`)                | —                | rỗng; chỉ 4 path `/admin/staff*` đổi thứ tự |
