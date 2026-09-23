---
description: Chạy quality gate chuẩn của repository và báo lỗi có ngữ cảnh, không tự nới lỏng rule để làm cho pass.
---

Chạy `npm run verify` từ repository root.

Nếu `$ARGUMENTS` chứa `e2e`, sau khi quality gate cơ bản pass thì chạy thêm `npm run test:e2e`.

Quy tắc:

1. Dừng ở command đầu tiên bị lỗi và đọc output để xác định file/test liên quan.
2. Nếu user chỉ yêu cầu verify, chỉ báo cáo lỗi; không tự sửa code.
3. Nếu user yêu cầu implement/fix, sửa nguyên nhân gốc trong phạm vi task rồi chạy lại quality gate đầy đủ.
4. Không bỏ qua test, giảm lint rule, thêm `any`, hoặc đổi assertion chỉ để làm CI xanh.
5. Khi pass, báo rõ các gate đã chạy; không khẳng định E2E đã pass nếu chưa chạy với đối số `e2e`.
