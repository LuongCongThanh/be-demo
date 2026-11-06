# Metric 01

Điền cột "Trước" ở bước 1 của [plan](./plan.md), cột "Sau" trước khi mở PR.

| Chỉ số                          | Cách đo                                                                                | Trước | Sau |
| ------------------------------- | -------------------------------------------------------------------------------------- | ----- | --- |
| Unit test (pass/total)          | `npm run test`                                                                         |       |     |
| E2E test (pass/total)           | `npm run test:e2e`                                                                     |       |     |
| Coverage `src/auth` (lines %)   | `npm run test:cov`                                                                     |       |     |
| Chỗ dùng tên role cũ            | `grep -rE "STORE_MANAGER\|MASTER_ADMIN\|ORDER_STAFF" src test prisma/seed.ts \| wc -l` |       | 0   |
| Bảng liên quan role             | đếm model `Role`, `UserRole`                                                           | 2     | 0   |
| Route catalog write cho `STAFF` | đếm `@Roles` có staff trên catalog                                                     |       | 0   |
| Thời gian làm (giờ)             | tự ghi                                                                                 | —     |     |
