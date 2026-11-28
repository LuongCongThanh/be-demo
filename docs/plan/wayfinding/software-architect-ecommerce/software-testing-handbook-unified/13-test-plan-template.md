# Test Plan & Traceability Template

Feature: ... | Owner: ... | Spec version: ... | Risk: ...

## Business rules minh họa: Create Order

| ID   | Rule                             | Test layer                   |
| ---- | -------------------------------- | ---------------------------- |
| BR01 | Login bắt buộc                   | API/E2E                      |
| BR02 | Cart không rỗng                  | Unit/API                     |
| BR03 | Product active                   | Integration                  |
| BR04 | Không vượt stock                 | Unit/integration/concurrency |
| BR05 | Giá từ backend                   | Unit/API/E2E                 |
| BR06 | Voucher còn hiệu lực             | Unit/integration             |
| BR07 | Retry không tạo order trùng      | Integration/API              |
| BR08 | Thất bại rollback                | Integration                  |
| BR09 | Không truy cập cart người khác   | API/security                 |
| BR10 | Payment fail không đánh dấu paid | Integration/contract         |

## Scenario matrix

| ID   | Rule | Preconditions / Input      | Expected                                               | Layer       | Priority | Status/evidence |
| ---- | ---- | -------------------------- | ------------------------------------------------------ | ----------- | -------- | --------------- |
| TC01 | BR01 | Không token                | 401                                                    | API         | P0       | Not run         |
| TC02 | BR02 | Cart rỗng                  | 400 theo spec                                          | API         | P1       | Not run         |
| TC03 | BR04 | Hai khách, stock 1         | Một thành công, stock 0                                | Integration | P0       | Not run         |
| TC04 | BR05 | Client gửi giá sai         | Giá server được dùng hoặc request bị từ chối theo spec | API         | P0       | Not run         |
| TC05 | BR07 | Retry cùng idempotency key | Một order                                              | Integration | P0       | Not run         |
| TC06 | BR08 | Lỗi giữa transaction       | Không partial order/stock change                       | Integration | P0       | Not run         |
| TC07 | BR09 | Cart người khác            | 403/404 theo spec                                      | API         | P0       | Not run         |
| TC08 | BR10 | Payment fail               | Không PAID                                             | Integration | P0       | Not run         |

Bổ sung happy checkout, voucher hết hạn, product inactive, webhook trùng/sai thứ tự, email/queue lỗi. HTTP status và chính sách voucher phải xác nhận với spec.

## Test case template

- ID / requirement / priority / layer
- Preconditions / fixtures / dependencies
- Given / When / Then
- Expected output, state, side effects, forbidden changes
- Actual result / evidence / status (Pass, Fail, Not run, N/A)
- Cleanup / residual risks

## Report

Test commands, passed/failed/skipped, coverage, mutation, flaky, known gaps, release recommendation. Không ghi PASS khi chưa chạy.
