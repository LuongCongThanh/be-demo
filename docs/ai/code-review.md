# AI Pull Request Review Instructions

**Trạng thái:** Đã chốt cho workflow AI

## 1. Purpose

Cung cấp code review nghiêm ngặt, có bằng chứng và chỉ đọc. Ưu tiên correctness, security, data integrity, module boundaries, regressions và compatibility.

Không sửa hoặc làm đẹp mã theo sở thích khi không liên quan đến defect. Không phát minh requirement nếu không có trong repository.

## 2. Scope

Review working changes hoặc diff/PR được yêu cầu theo base branch hoặc commit cụ thể.

- Bao gồm file modified, added, deleted và renamed.
- Đọc surrounding code và call sites cần thiết.
- Trace behavior qua module boundaries khi thay đổi chạm nhiều module.
- Ưu tiên source files thay vì generated files.
- Luôn ghi base/commit và diff được review.

## 3. Mandatory Context Discovery

Trước khi kết luận:

1. Đọc root `AGENTS.md` và mọi `AGENTS.md` áp dụng cho changed paths.
2. Đọc Task/User Story, acceptance criteria trong `docs/plan/`.
3. Đọc business rules, glossary, architecture và ADR liên quan.
4. Đọc convention phù hợp: API, Prisma, coding, config, error/log và git workflow.
5. Kiểm tra implementation, DTO, validator, service, repository, schema, migration, test và caller.

Nếu tài liệu được tham chiếu không tồn tại, ghi rõ trong verification gap. Không giả định nội dung thiếu.

## 4. Review Workflow

### A. Understand the change

- Xác định mục đích và behavior mong muốn.
- So sánh với Task/User Story/acceptance criteria và business rules.
- Xác định module, public interface và dependency bị ảnh hưởng.
- Kiểm tra thay đổi ngoài scope.

### B. Architecture and module boundaries

- Kiểm tra ownership và dependency direction.
- Kiểm tra cross-module access qua public service/interface.
- Phát hiện truy cập trực tiếp repository/bảng nội bộ module khác.
- Kiểm tra circular dependency và duplicated business logic.

### C. API contract

- Route, method, path, DTO, validation, serialization.
- HTTP status, error code, authentication, authorization, ownership và data scope.
- Pagination, filtering, sorting và backward compatibility.
- Swagger/OpenAPI, Postman và client compatibility.

### D. Database and data integrity

- Prisma schema, migration, index, constraint, relation.
- Transaction, atomicity, nullability, uniqueness và referential integrity.
- Existing-data compatibility và migration safety.
- Race, duplicate write, lost update, locking, retry và idempotency.

### E. Security

- Broken authentication/authorization và IDOR/BOLA.
- Missing ownership/tenant scope.
- Injection, mass assignment và unsafe input.
- Secret, token và sensitive data trong logs, response hoặc source.
- Unsafe file, URL, callback hoặc external-service handling.

### F. Correctness and performance

- Business rule sai, boundary và state transition sai.
- Null/undefined assumptions và invalid state.
- N+1, unbounded reads, pagination và expensive query.
- Timezone, currency, precision hoặc rounding.
- Async/error handling và resource leak.

### G. Reliability and observability

- Error propagation và consistent response.
- Partial side effect và transaction failure path.
- Logs hữu ích nhưng không lộ dữ liệu nhạy cảm.
- Timeout, retry, queue duplicate processing và recovery.

### H. Tests

- Test có phủ behavior thay đổi và edge cases quan trọng không.
- Negative cases, authorization boundaries và regression đã được kiểm tra chưa.
- Không claim test pass nếu chưa chạy và pass.

### I. Deployment and compatibility

- Environment variable, `.env.example`, startup validation và scripts.
- Migration/deployment order, backward compatibility và rollback.
- Feature flag, seed data, external configuration và operational steps.

### J. Final verification

- Re-check từng finding với diff và surrounding code.
- Chỉ giữ finding actionable, được change này tạo ra hoặc làm nghiêm trọng hơn.
- Không giữ speculative hoặc style-only findings.

## 5. Severity

- **CRITICAL** — Exploitable security issue, catastrophic data loss/corruption hoặc production outage nghiêm trọng.
- **HIGH** — Authorization bypass, broken critical workflow, unsafe migration hoặc serious data integrity defect.
- **MEDIUM** — Bug/regression có scope hạn chế nhưng cần hướng dẫn hoặc workaround.
- **LOW** — Minor defect có impact giới hạn. Không báo style preference.

## 6. Finding Requirements

Mỗi finding phải:

1. Chỉ exact changed file và line range.
2. Mô tả input/state/action trigger.
3. Mô tả concrete impact.
4. Giải thích vì sao current code tạo ra lỗi.
5. Đề xuất correction thực tế.
6. Dựa trên diff và repository evidence.

Không báo pure style, hypothetical issue không có execution path, pre-existing issue không bị change làm worse, hoặc defect đã bị validation/constraint/transaction khác xử lý rõ ràng.

## 7. Review-Only Restrictions

- Không edit, create, delete, format hoặc tự động fix.
- Không commit, push, merge, rebase hoặc switch branch.
- Không chạy destructive command hoặc mutating database/external system.
- Có thể chạy safe read-only inspection và test không mutating.
- Hỏi trước khi command có thể install dependencies, generate files, contact production hoặc mutate state.

## 8. Report Format

# Code Review Report

## Review Context

- Base branch / commit:
- Reviewed diff:
- Relevant Task / User Story:
- Relevant documents:
- Checks executed:

## Findings

Liệt kê từ severity cao xuống thấp.

### [CRITICAL/HIGH/MEDIUM/LOW] Short, specific title

- **File:** `path/to/file`
- **Lines:** `start-end`
- **Scenario:** Input/state/action trigger issue.
- **Impact:** Hậu quả cụ thể.
- **Evidence:** Vì sao changed code tạo ra issue.
- **Recommendation:** Corrections đề xuất.

Nếu không có finding: `No actionable findings identified in the reviewed diff.`

## Verification Gaps

- Liệt kê test, document, environment hoặc check không thể verify.
- Tách rõ verification gap khỏi confirmed defect.

## Summary

- Finding counts by severity.
- Overall risk: Low / Medium / High / Critical.
- Caveats và unverified areas.

## 9. Git Commit Identity

Trong mọi nội dung Git, không thêm AI/tool/agent name, AI attribution trailer, hoặc AI-specific author/committer metadata. Không commit trừ khi được yêu cầu rõ ràng.
