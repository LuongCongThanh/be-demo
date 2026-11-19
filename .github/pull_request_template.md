# Pull Request

> Mục tiêu: Mô tả thay đổi, cung cấp bằng chứng kiểm thử và giúp Human/AI Reviewer đánh giá PR dựa trên yêu cầu thực tế.
>
> **Quy ước:**
>
> - Ghi thông tin thực tế, không ghi kết quả kỳ vọng như kết quả đã đạt được.
> - Mục không áp dụng ghi `N/A`.
> - Không đánh dấu hoàn thành nếu chưa thực hiện.
> - Ưu tiên liên kết tài liệu thay vì sao chép nội dung dài.

---

## 🏷️ 1. Type

<!-- Chọn một loại chính. Tiêu đề PR theo Conventional Commits. -->

- [ ] ✨ Feature (`feat`)
- [ ] 🐛 Bug Fix (`fix`)
- [ ] ♻️ Refactor (`refactor`)
- [ ] ⚡ Performance (`perf`)
- [ ] 🔒 Security (`security` hoặc `fix` theo quy ước repo)
- [ ] 🧹 Chore (`chore`)
- [ ] 📚 Documentation (`docs`)
- [ ] 🧪 Test (`test`)
- [ ] 🏗️ Architecture (`refactor` hoặc `chore`)

**Breaking Change:** Yes / No

---

## 📌 2. Summary

### 2.1. Làm gì?

<!-- Mô tả hành vi mới hoặc hành vi được thay đổi trong 1–2 câu. Không liệt kê file. -->

### 2.2. Vì sao?

<!-- Vấn đề hiện tại, yêu cầu nghiệp vụ, hậu quả nếu không sửa. Reviewer phải hiểu được lý do mà không cần mở Task. -->

### 2.3. Giải pháp

<!-- Mô tả cách giải quyết và lý do lựa chọn. Với logic phức tạp, có thể bổ sung pseudocode hoặc flow. -->

### 2.4. Kết quả thực tế

<!-- Before → After, có số liệu hoặc bằng chứng nếu đo được. Phân biệt kết quả đã xác minh với kết quả chưa xác minh. -->

### 2.5. Scope & Traceability

- **Module chính:**
- **Các module bị ảnh hưởng:**
- **Task:** `docs/plan/tasks/NN-xxx`
- **User Story:** `US-XXX`
- **Business Rules:** `BR-XXX`
- **ADR:** `ADR-XXXX` / `N/A`

---

## 📋 3. Changes

<!-- Nhóm theo hành vi hoặc mục đích nghiệp vụ. Format: Nhóm thay đổi → Nội dung → Lý do. -->

-
-
-

---

## 🔌 4. API Contract

<!-- Ghi N/A nếu PR không ảnh hưởng API contract. -->

### 4.1. Endpoint Changes

| Method | Endpoint      | Change                | Breaking |
| ------ | ------------- | --------------------- | -------- |
| POST   | `/api/v1/...` | Add / Update / Remove | Yes / No |

### 4.2. Request / Response

- **Request DTO:**
- **Response DTO:**
- **Validation:**
- **HTTP Status Codes:**
- **Error Codes:**
- **Pagination / Filtering / Sorting:**

### 4.3. Authentication & Authorization

- **Authentication:** Required / Optional / Public
- **Authorization:**
- **Roles / Permissions:**
- **Resource Ownership / Data Access:**

### 4.4. Compatibility

- **Backward Compatible:** Yes / No / N/A
- **Affected Clients:** Web / Mobile / External API / Internal Services / N/A
- **Deprecated Fields / Endpoints:**
- **Swagger / OpenAPI:** Updated / N/A
- **Postman Collection:** Synced / N/A

---

## 🗄️ 5. Database / Migration / Configuration

### 5.1. Database

- **Schema Changes:** Yes / No
- **Affected Tables / Models:**
- **Index / Constraints:**
- **Transaction / Data Integrity:**
- **Data Migration:**

### 5.2. Migration

- **Migration Required:** Yes / No
- **Migration File:**
- **Backward Compatible:** Yes / No / N/A
- **Rollback / Recovery:**
- **Production Data Impact:**

### 5.3. Configuration

- **New / Changed Environment Variables:**
- **Default Values:**
- **`.env.example`:** Updated / N/A
- **Environment Validation:** Updated / N/A
- **NPM Scripts:**
- **External Dependencies:** Redis / Queue / Payment Gateway / SMTP / Other / N/A

---

## 🧪 6. Testing & Verification

### 6.1. Acceptance Criteria Verification

<!-- Liên kết từng AC với test hoặc bằng chứng thực tế. -->

| AC    | Expected Behavior | Test / Evidence | Result            |
| ----- | ----------------- | --------------- | ----------------- |
| AC-01 |                   |                 | Pass / Fail / N/A |
| AC-02 |                   |                 | Pass / Fail / N/A |
| AC-03 |                   |                 | Pass / Fail / N/A |

### 6.2. Automated Tests

- **Unit Tests:**
- **Integration Tests:**
- **E2E / API Tests:**
- **Contract Tests:**
- **Regression Tests:**
- **Coverage:**

### 6.3. Manual Verification

<!-- Ghi các bước tái hiện và kết quả thực tế. -->

- **Scenario:**
- **Input:**
- **Steps:**
- **Expected Result:**
- **Actual Result:**

### 6.4. Commands Executed

| Command             | Result            |
| ------------------- | ----------------- |
| `npm run lint`      | Pass / Fail / N/A |
| `npm run typecheck` | Pass / Fail / N/A |
| `npm run test`      | Pass / Fail / N/A |
| `npm run test:e2e`  | Pass / Fail / N/A |
| `npm run build`     | Pass / Fail / N/A |

---

## 🔒 7. Security / Performance / Data Integrity

### 7.1. Security

- [ ] Authentication và Authorization được kiểm tra phù hợp.
- [ ] Không phát sinh IDOR/BOLA hoặc truy cập vượt quyền.
- [ ] Input được validate và sanitize phù hợp.
- [ ] Không lộ secret, token hoặc dữ liệu nhạy cảm.
- [ ] Error response không tiết lộ thông tin nội bộ.
- [ ] Rate limiting / abuse protection được xem xét nếu cần.
- **Notes:**

### 7.2. Performance

- [ ] Không phát sinh N+1 query.
- [ ] Chỉ truy vấn các trường cần thiết.
- [ ] Pagination được áp dụng cho danh sách phù hợp.
- [ ] Index phù hợp với truy vấn mới.
- [ ] Không phát sinh xử lý nặng không cần thiết trong request.
- **Notes:**

### 7.3. Data Integrity & Concurrency

- [ ] Transaction được sử dụng khi cần.
- [ ] Không tạo duplicate data ngoài ý muốn.
- [ ] Race condition được xử lý nếu có concurrency.
- [ ] Unique constraints / Foreign Keys được xem xét.
- [ ] Retry / Idempotency phù hợp với nghiệp vụ.
- [ ] Không làm mất hoặc ghi đè dữ liệu ngoài dự kiến.
- **Notes:**

---

## ⚠️ 8. Gap / Risks / Reviewer Attention

<!-- Bắt buộc xem xét từng mục. Ghi N/A nếu không có. -->

### 8.1. Chưa hoàn thành

-

### 8.2. Known Limitations / Edge Cases

-

### 8.3. Risks

-

### 8.4. Temporary Decisions

<!-- Giải pháp tạm thời, lý do và thời điểm cần xử lý lại. -->

-

### 8.5. Follow-up Tasks

<!-- Ticket phát sinh ngoài phạm vi PR, ưu tiên liên kết ticket needs-triage. -->

-

### 8.6. Reviewer Attention

<!-- Các đoạn logic phức tạp, common/shared code, module boundary, transaction, migration hoặc sai khác có chủ đích với tài liệu. -->

-

---

## 🚀 9. Deployment / Rollback

### 9.1. Deployment Requirements

- **Migration Before Deploy:** Yes / No / N/A
- **Environment Variables:**
- **Seed Data:** Yes / No / N/A
- **External Configuration:**
- **Deployment Order:**
- **Post-Deploy Actions:**

### 9.2. Rollback / Recovery

- **Rollback Required:** Yes / No / N/A
- **Rollback Procedure:**
- **Database Recovery:**
- **Compatibility During Rollback:**

### 9.3. Post-Deploy Verification

- **Health Check:**
- **Application Logs:**
- **Error Rate / Metrics:**
- **Database State:**
- **Other:**

---

## 🏛️ 10. Architecture / Documentation

- **Module Boundaries:**
- **Architecture Changes:**
- **ADR:**
- **Business Rules:**
- **Glossary:**
- **API Documentation:**
- **Other Documentation:**

---

## ✅ 11. Definition of Done

<!-- Chỉ đánh dấu khi đã thực hiện và có thể xác minh. Mục không áp dụng được phép ghi N/A. -->

### General

- [ ] Đáp ứng mục tiêu Task / User Story.
- [ ] Không có thay đổi ngoài phạm vi.
- [ ] Tuân thủ coding conventions.
- [ ] Không có debug code hoặc log không cần thiết.
- [ ] Lint / Typecheck / Build phù hợp đã pass.
- [ ] Có test cho logic mới và trường hợp biên.
- [ ] Không lộ secret hoặc dữ liệu nhạy cảm.

### Architecture

- [ ] Tuân thủ module boundaries.
- [ ] Module khác chỉ được truy cập qua public service/interface.
- [ ] Không truy cập trực tiếp repository hoặc bảng nội bộ của module khác.
- [ ] Không phát sinh circular dependency ngoài kiến trúc cho phép.

Reference: `docs/architecture/02-modules.md`

### API

- [ ] DTO, validation, response và HTTP status phù hợp.
- [ ] Error codes tuân thủ quy ước.
- [ ] Authentication / Authorization được kiểm tra.
- [ ] Swagger/OpenAPI được cập nhật nếu contract thay đổi.
- [ ] Backward compatibility được xem xét.
- [ ] Postman được đồng bộ nếu contract thay đổi.

### Database

- [ ] Prisma schema được cập nhật nếu cần.
- [ ] Migration được tạo và kiểm tra.
- [ ] Transaction / Index / Constraints phù hợp.
- [ ] Migration an toàn với dữ liệu hiện có.
- [ ] Rollback / Recovery được xem xét.

Reference: `docs/convention/prisma-conventions.md`

### Security / Performance

- [ ] Không phát sinh lỗ hổng phân quyền đã biết.
- [ ] Không lộ thông tin nhạy cảm.
- [ ] Không phát sinh N+1 query.
- [ ] Pagination được áp dụng phù hợp.
- [ ] Concurrency / Idempotency được xem xét nếu nghiệp vụ yêu cầu.

### Documentation / Deployment

- [ ] Business Rules / Glossary / ADR được cập nhật nếu cần.
- [ ] `.env.example` được cập nhật nếu có biến mới.
- [ ] Environment validation được cập nhật nếu cần.
- [ ] Có hướng dẫn deploy nếu ảnh hưởng môi trường.
- [ ] Có hướng dẫn rollback/recovery nếu cần.

### Breaking Changes

- [ ] Breaking change được ghi rõ.
- [ ] Tiêu đề PR có `!` theo Conventional Commits nếu áp dụng.
- [ ] Migration và kế hoạch chuyển đổi client đã được xem xét.

---

## 💬 12. Notes

<!-- Thông tin bổ sung, PR phụ thuộc, quyết định đã thống nhất hoặc kết luận review. -->
<!-- Ghi kết quả code-review: ví dụ "code-review: 0 findings" hoặc "code-review: 2 findings, 2 fixed". -->

-

---

## 📖 Project References

- [Project README](../blob/dev/README.md)
- [Git Workflow](../blob/dev/docs/convention/git-workflow.md)
- [API Rules / Definition of Done](../blob/dev/docs/convention/api-rules.md)
- [Module Architecture](../blob/dev/docs/architecture/02-modules.md)
- [Prisma Conventions](../blob/dev/docs/convention/prisma-conventions.md)
- [Task Planning](../tree/dev/docs/plan/tasks)
