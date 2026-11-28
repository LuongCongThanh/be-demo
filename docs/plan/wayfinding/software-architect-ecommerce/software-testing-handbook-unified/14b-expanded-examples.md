# Ví dụ và bảng tham chiếu bổ sung từ các trao đổi

## Coverage 100% nhưng bug vẫn tồn tại

| Input giá, giảm giá | Output công thức | Đánh giá theo spec giá không âm, discount 0–100 |
| ------------------- | ---------------: | ----------------------------------------------- |
| 100,20              |               80 | Đúng                                            |
| 100,0               |              100 | Đúng                                            |
| 100,150             |              -50 | Sai                                             |
| 100,-20             |              120 | Sai                                             |
| -100,20             |              -80 | Sai                                             |
| 100,NaN             |              NaN | Sai                                             |

Một test duy nhất có thể đạt statement, branch, function, line coverage 100% với hàm không có nhánh. E2E checkout: login → search → cart → checkout → payment → order → email. Tất cả pass vẫn có thể bỏ sót hai khách cùng đọc stock=1 rồi cùng đặt thành công. Kiểm tra đồng thời với database thật; dùng transaction/locking/atomic update phù hợp.

## Negative cases minh họa

| Case                           | Expected theo spec giả định |
| ------------------------------ | --------------------------- |
| Không login hoặc token hết hạn | 401                         |
| Giỏ rỗng                       | 400                         |
| Product không tồn tại          | Từ chối                     |
| Thiếu stock                    | 409                         |
| Voucher hết hạn                | Từ chối voucher             |
| Truy cập order người khác      | 403/404                     |

## Fault injection

| Failure           | Kiểm tra          |
| ----------------- | ----------------- |
| DB mất kết nối    | Error handling    |
| Cache unavailable | Fallback nếu có   |
| Payment timeout   | Retry/idempotency |
| Email thất bại    | Retry queue       |
| API 500           | Error handling    |
| Transaction lỗi   | Rollback          |
| Network gián đoạn | Consistency       |

## Traceability minh họa

| Requirement  | Unit | Integration | E2E |
| ------------ | ---- | ----------- | --- |
| Giá đơn hàng | Có   | Có          | Có  |
| Voucher      | Có   | Có          | Có  |
| Stock        | Có   | Có          | Có  |
| Overselling  | —    | Có          | Tùy |
| Rollback     | —    | Có          | —   |
| Chống trùng  | Có   | Có          | Có  |
| Phân quyền   | Có   | Có          | Có  |
| Webhook      | Có   | Có          | Tùy |
| Email        | Có   | Có          | Tùy |
| Checkout     | —    | Có          | Có  |

## Cấu trúc tài liệu chi tiết đề xuất

```text
docs/testing/
  README.md
  testing-strategy.md
  testing-architecture.md
  testing-standards.md
  test-quality-checklist.md
  test-design-guidelines.md
  assertion-guidelines.md
  mocking-guidelines.md
  test-data-management.md
  mutation-testing.md
  security-testing.md
  performance-testing.md
  risk-assessment.md
  traceability-matrix.md
  quality-gates.md
  definition-of-done.md
  test-case-template.md
  test-review-checklist.md
  regression-testing.md
  test-plans/  # mỗi feature một file
```

## Prompt audit tổng quát

Read all testing documentation. Audit the current project without modifying source code. Evaluate architecture, master checklist, requirements, critical risks, assertion quality, mocks, missing test layers, concurrency, security, performance, data integrity, coverage, mutation testing and CI/CD gates. Produce a prioritized P0–P3 roadmap with evidence, assumptions, limitations, untested scenarios and remaining risks. Focus on fault detection rather than coverage alone.
