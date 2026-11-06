# Metrics: realign identity & catalog (task 01–05)

Branch `refactor/realign-identity-catalog` (tách từ `dev`). Năm task làm trên một branch, mỗi task một commit. Agent: Claude Code (Opus 5.5), một phiên, làm theo skill TDD.

## 1. Token

> **Lưu ý:** agent không đọc được bộ đếm token thật của phiên. Mọi con số token dưới đây là **ước tính**. Số thật xem bằng `/cost` trong Claude Code hoặc trang usage của Console.

Cách ước tính:

- **Token của nội dung đã commit** = số ký tự của các dòng thêm mới (`git show -U0`) chia 3,5. Code TypeScript khoảng 3,5–4 ký tự/token; comment tiếng Việt có dấu tốn hơn, khoảng 2,5. Lấy 3,5 làm trung bình.
- **Token output thật** cao hơn phần đã commit, vì còn lệnh shell, script sửa file, lần sửa lỗi lại và tin nhắn giải thích. Ước tính gấp khoảng 2 lần.
- **Token input** tăng theo độ dài hội thoại. Có khoảng 95 lần gọi tool, context trung bình khoảng 120k token mỗi lần, đa số là cache read.

| Hạng mục                                  | Ước tính                 |
| ----------------------------------------- | ------------------------ |
| Output: nội dung đã commit                | ≈ 48.500 token           |
| Output: tổng (gồm lệnh, sửa lại, trả lời) | ≈ 90.000 – 110.000 token |
| Input (cộng dồn, phần lớn là cache read)  | ≈ 9 – 12 triệu token     |

## 2. Dòng code ↔ token, theo loại file

"Code" là `src/**` (trừ `*.spec.ts`), `prisma/seed.ts` và `package.json`. "Test" là `*.spec.ts` và `test/**`. "Schema" là `prisma/schema/**` và `prisma/migrations/**`. "Doc" là `*.md` và `docs/**`.

| Loại       | Dòng thêm |  Dòng xoá |  Ký tự thêm | Token ước tính (ký tự / 3,5) | Token / dòng thêm |
| ---------- | --------: | --------: | ----------: | ---------------------------: | ----------------: |
| Code       |     2.339 |       764 |      89.678 |                     ≈ 25.600 |              ≈ 11 |
| Test       |     1.435 |       741 |      66.179 |                     ≈ 18.900 |              ≈ 13 |
| Schema/SQL |       326 |        47 |      13.935 |                      ≈ 4.000 |              ≈ 12 |
| Doc        |         0 |         0 |           0 |                            0 |                 — |
| **Tổng**   | **4.100** | **1.552** | **169.792** |                 **≈ 48.500** |          **≈ 12** |

Năm commit task không thêm doc nào; file metrics này là doc duy nhất, khoảng 1.500 token.

Tỷ lệ dòng test / dòng code ≈ 0,61.

## 3. Theo từng task

| Task                    | Commit    | Code (+/−)  | Test (+/−)  | Schema (+/−) | Token ước tính |
| ----------------------- | --------- | ----------- | ----------- | ------------ | -------------: |
| 01 Bốn vai trò          | `0834df1` | +78 / −109  | +213 / −189 | +57 / −33    |        ≈ 4.600 |
| 02 Staff, CLI, audit    | `e5d0446` | +653 / −4   | +318 / −2   | +51 / −0     |       ≈ 10.600 |
| 03 Trạng thái & archive | `a68d3a8` | +480 / −332 | +272 / −228 | +29 / −4     |       ≈ 10.100 |
| 04 Size/màu & biến thể  | `406f041` | +746 / −125 | +417 / −165 | +170 / −10   |       ≈ 16.000 |
| 05 Danh mục nhiều cấp   | `2348428` | +382 / −194 | +215 / −157 | +19 / −0     |        ≈ 7.300 |

Task 04 tốn nhiều nhất: hai bảng mới, ảnh theo màu, filter storefront và một migration chuyển dữ liệu viết tay.

## 4. Kết quả test

| Chỉ số    | Trước (`dev`)    | Sau                |
| --------- | ---------------- | ------------------ |
| Unit test | 180 / 180        | 161 / 161          |
| E2E test  | 90 / 90 (1 skip) | 173 / 173 (1 skip) |

Unit test giảm vì đã xoá hoặc gộp các test gắn với chi tiết cài đặt cũ (DTO variant cho phép giá thập phân, các hàm `remove`/`removeVariant` không còn tồn tại). Các quy tắc mới được kiểm ở seam e2e HTTP, theo đúng seam đã chốt trong spec.

## 5. Lệch so với spec

- Giá trị enum viết HOA ở mọi nơi (`DRAFT/ACTIVE/ARCHIVED`), theo quyết định của task 01. Spec 03/04 ghi chữ thường.
- Route customer-only để kiểm chứng (task 02): `GET /api/v1/me`, trả hồ sơ khách hàng.
- CLI dùng `NestFactory.createApplicationContext`, không dùng `nest-commander` (spec cho phép cả hai). Lệnh: `npm run build && npm run cli -- create-admin --email … --name …`.
- `audit_logs` theo cột của `11-database` §4.1 (`before`/`after`/`reason`/`request_id`), không theo cột `metadata` ghi trong spec 02.
- Thêm route công khai `GET /sizes`, `GET /colors` để storefront dựng bộ lọc (spec chỉ nói "không xuất hiện trong filter").
- Màu chuyển từ dữ liệu text cũ có hex tạm `#000000`; seed mới đã có hex thật.

## 6. Chưa làm / chưa kiểm

- Nhánh "giá có phần lẻ → migration fail" của task 04 chưa chạy thử trên dữ liệu có giá lẻ (DB dev không có).
- Chưa chạy `npm run postman:sync`, `/code-review`, `/ship`. Chưa push, chưa mở PR.
- Chưa cập nhật `status` trong `spec.md` / bảng `docs/plan/README.md`, `report.md`, và `architecture/modules/*.md` ("Nháp" → "Đã chốt"). Các mục này làm sau khi merge.
