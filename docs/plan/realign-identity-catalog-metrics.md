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

## 6. Vòng review (`/code-review`) và sửa

Review hai trục chạy bằng hai sub-agent song song. Số token sub-agent dưới đây là **số thật**, lấy từ thông báo hoàn thành của harness; các số khác vẫn là ước tính như mục 1.

| Hạng mục                                       | Token                      | Ghi chú                         |
| ---------------------------------------------- | -------------------------- | ------------------------------- |
| Sub-agent Standards                            | 66.232 (thật)              | 10 lần gọi tool, ~40 giây       |
| Sub-agent Spec                                 | 109.894 (thật)             | 16 lần gọi tool, ~73 giây       |
| Sửa sau review: nội dung đã commit (`42cdba9`) | ≈ 1.900 (ước tính)         | 6.595 ký tự thêm / 3,5          |
| Sửa sau review: tổng output phiên chính        | ≈ 6.000 – 8.000 (ước tính) | gồm lệnh, test đỏ/xanh, trả lời |

Commit sửa `42cdba9`:

| Loại | Dòng thêm | Dòng xoá | Ký tự thêm | Token ước tính |
| ---- | --------: | -------: | ---------: | -------------: |
| Code |       103 |       81 |      4.727 |        ≈ 1.350 |
| Test |        24 |        0 |      1.170 |          ≈ 330 |
| Doc  |         2 |        2 |        698 |          ≈ 200 |

Kết quả review: Standards có 0 vi phạm cứng và 6 code smell; Spec có khoảng 10 phát hiện. Đã sửa:

- Filter storefront bỏ qua mã size/màu đã ẩn (task 04, viết test đỏ trước).
- Đổi tên Staff thành đúng tên cũ không ghi audit (task 02, viết test đỏ trước).
- Gom phân trang về `common/pagination/paginate.ts` và tạo slug về `common/slug.util.ts`.
- Xoá ảnh không đọc trước; va chạm partial unique index của ảnh primary trả 409.
- Đổi `toResponse` → `toStaffResponse`.
- Doc `identity.md`, `catalog.md` chuyển "Đã chốt cho MVP" (task 05).

Giữ nguyên vì là lệch có chủ đích hoặc chỉ là đánh giá chủ quan: audit `admin.create` cho CLI; `JwtStrategy` so cả role; unarchive DRAFT trả 400; `PATCH` biến thể nhận `status`; route `GET /categories/:id`; migration ảnh báo lỗi thay vì map; kiểm tra vòng lặp không khoá dòng; truyền `actorUserId` rời (data clump).

Test sau vòng sửa: unit 161/161, e2e 175/175 (1 skip).

## 7. Vòng `/ship`: CI chặn vì coverage unit

Sau khi mở PR #60, check `unit-test` của CI (`npm run test:cov`, ngưỡng 50%) báo đỏ: coverage unit giảm từ khoảng 57% xuống 36%. Ở local chỉ chạy `npm run test`, không chạy `test:cov`, nên không bắt được. Nguyên nhân gốc: các service mới chỉ được test qua e2e, trong khi `api-conventions` ghi rõ "Service unit test bắt buộc nếu service có business logic". Cả hai sub-agent review đều bỏ sót điểm này.

Xử lý: thêm unit test cho service (mock `PrismaService`), không hạ ngưỡng. Commit `test: unit tests for new identity & catalog services`:

| Loại | Dòng thêm | Ký tự thêm | Token ước tính |
| ---- | --------: | ---------: | -------------: |
| Test |       890 |     35.381 |       ≈ 10.100 |

Tổng output phiên chính cho vòng này (gồm đo coverage, sửa lỗi kiểu, trả lời) ước tính khoảng 15.000 – 18.000 token.

| Chỉ số          | Trước  | Sau    |
| --------------- | ------ | ------ |
| Unit test       | 161    | 233    |
| Coverage lines  | 36,13% | 60,64% |
| Coverage branch | 37,52% | 67,64% |
| Coverage funcs  | 31,31% | 57,65% |

Bài học: chạy `npm run test:cov` ở bước Definition of Done thay vì `npm run test`, vì CI dùng lệnh đó.

## 8. Tổng cộng cả đợt

| Loại       | Dòng thêm | Token ước tính (nội dung commit) |
| ---------- | --------: | -------------------------------: |
| Code       |     2.442 |                         ≈ 26.900 |
| Test       |     2.349 |                         ≈ 29.300 |
| Schema/SQL |       326 |                          ≈ 4.000 |
| Doc        |     ≈ 150 |                          ≈ 3.500 |

Token của hai sub-agent review: 176.126 (số thật). Tổng output phiên chính cả đợt ước tính khoảng 120.000 – 140.000 token.

## 9. Chưa làm / chưa kiểm

- Nhánh "giá có phần lẻ → migration fail" của task 04 chưa chạy thử trên dữ liệu có giá lẻ (DB dev không có).
- `npm run postman:sync` cần `POSTMAN_API_KEY`, chạy khi có key.
- Chưa cập nhật `status` trong `spec.md`, bảng `docs/plan/README.md` và `report.md`; các mục này làm sau khi merge.
