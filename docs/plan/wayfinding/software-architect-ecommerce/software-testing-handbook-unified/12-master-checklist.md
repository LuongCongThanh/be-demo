# Master High-Quality Testing Checklist

Đánh dấu [x] khi có bằng chứng; N/A kèm lý do.

## 1. Requirement Analysis

- [ ] Functional requirements
- [ ] Non-functional requirements
- [ ] Business rules
- [ ] Acceptance criteria kiểm chứng được
- [ ] Input/output/side effects
- [ ] Preconditions/postconditions
- [ ] Roles và permissions
- [ ] Dependencies
- [ ] Làm rõ yêu cầu mơ hồ
- [ ] Mapping requirement với scenario

## 2. Risk Analysis

- [ ] Critical flows
- [ ] Phân loại xác suất và tác động
- [ ] Mất hoặc sai dữ liệu
- [ ] Sai tiền/payment
- [ ] Race condition
- [ ] Security
- [ ] Third-party failure
- [ ] Quá tải
- [ ] Deploy/migration
- [ ] Ưu tiên theo risk

## 3. Test Design

- [ ] Happy path
- [ ] Negative
- [ ] Boundary value
- [ ] Equivalence partition
- [ ] Edge cases
- [ ] Decision table
- [ ] State transition
- [ ] Pairwise
- [ ] Property-based
- [ ] Error guessing
- [ ] Exploratory
- [ ] Regression
- [ ] Expected result độc lập
- [ ] Hành vi được phép và bị cấm

## 4. Test Architecture

- [ ] Unit
- [ ] Component
- [ ] Integration
- [ ] Database thật
- [ ] API
- [ ] Contract
- [ ] E2E
- [ ] Visual regression
- [ ] Accessibility
- [ ] Concurrency
- [ ] Performance
- [ ] Security
- [ ] Smoke
- [ ] Tránh trùng lặp vô ích

## 5. Test Implementation

- [ ] FIRST
- [ ] AAA hoặc Given–When–Then
- [ ] Tên mô tả hành vi
- [ ] Một kịch bản nhất quán
- [ ] Observable behavior
- [ ] Không phụ thuộc thứ tự
- [ ] Không phụ thuộc test khác
- [ ] Không logic phức tạp vô ích
- [ ] Parameterized tests
- [ ] Không hard-coded sleep
- [ ] Kiểm soát clock/timezone/random
- [ ] Chạy độc lập
- [ ] Parallel an toàn
- [ ] Thông báo lỗi hữu ích
- [ ] Không sửa production code chỉ để test sai pass

## 6. Assertion Quality

- [ ] Không chỉ toBeDefined/toBeTruthy
- [ ] Giá trị chính xác
- [ ] Trạng thái nghiệp vụ
- [ ] Database state
- [ ] Email/event/queue
- [ ] HTTP status và body
- [ ] Error code/message theo contract
- [ ] Dữ liệu không được thay đổi
- [ ] Hành động bị cấm
- [ ] Số lần side effect quan trọng
- [ ] Không assertion quá rộng
- [ ] Expected không sao chép implementation
- [ ] Không nuốt lỗi hoặc bỏ assertion
- [ ] Chứng minh test fail khi logic sai

## 7. Test Data

- [ ] Factory
- [ ] Fixture
- [ ] Builder
- [ ] Isolation
- [ ] Cleanup
- [ ] Không dùng production DB
- [ ] Không PII/secret thật
- [ ] Valid/invalid
- [ ] Null/undefined/empty
- [ ] Boundary
- [ ] Dữ liệu lớn/trùng
- [ ] Unicode
- [ ] Timezone/locale/currency
- [ ] Random seed tái tạo được

## 8. Mock & Dependency

- [ ] Mock có lý do
- [ ] Không mock logic đang test
- [ ] Không overmock internal service
- [ ] Database thật tương ứng với production (ví dụ PostgreSQL)
- [ ] Cache thật tương ứng với production (ví dụ Redis/Valkey)
- [ ] Testcontainers hoặc môi trường cô lập
- [ ] Third-party mock theo contract
- [ ] Success/failure response
- [ ] Reset mock
- [ ] Response thực tế
- [ ] Sandbox khi có
- [ ] Xác minh contract mock

## 9. Database & Integrity (nếu có lưu trữ)

- [ ] Primary/foreign key
- [ ] Unique
- [ ] Not null/check
- [ ] Commit
- [ ] Rollback
- [ ] Atomicity
- [ ] Consistency
- [ ] Concurrent updates
- [ ] Locking
- [ ] Deadlock handling
- [ ] Migration với dữ liệu cũ
- [ ] Pagination/sorting ổn định
- [ ] Duplicate records
- [ ] Soft/cascade delete
- [ ] Decimal và tiền

## 10. Concurrency & Resilience

- [ ] Concurrent requests
- [ ] Race condition
- [ ] Lost update
- [ ] Duplicate request
- [ ] Idempotency
- [ ] Retry
- [ ] Timeout
- [ ] Network failure
- [ ] DB failure
- [ ] Cache failure
- [ ] Third-party failure
- [ ] Queue failure/duplicate
- [ ] Webhook trùng/sai thứ tự
- [ ] Partial failure
- [ ] Recovery

## 11. User Interface / Frontend (nếu có UI)

- [ ] Loading
- [ ] Empty
- [ ] Error
- [ ] Success
- [ ] Form validation
- [ ] User interaction
- [ ] Keyboard
- [ ] Responsive
- [ ] Cross-browser
- [ ] Accessibility
- [ ] Double submit
- [ ] API error
- [ ] Stale data/cache invalidation
- [ ] Protected routes
- [ ] SSR/hydration
- [ ] Role/accessibility locators
- [ ] Tránh CSS selector dễ vỡ
- [ ] Dữ liệu lớn/nội dung dài

## 12. Security

- [ ] Authentication
- [ ] RBAC
- [ ] Object authorization/IDOR
- [ ] SQL injection
- [ ] XSS
- [ ] CSRF khi áp dụng
- [ ] Input validation
- [ ] Rate limiting
- [ ] Token expiry
- [ ] Session revocation
- [ ] File upload
- [ ] Sensitive data exposure
- [ ] Mass assignment
- [ ] Privilege escalation
- [ ] Webhook signature
- [ ] Không lộ secret trong log/response

## 13. Performance

- [ ] SLO
- [ ] Baseline
- [ ] Load
- [ ] Stress
- [ ] Spike
- [ ] Soak
- [ ] p95/p99
- [ ] Throughput/error rate
- [ ] Memory leak
- [ ] Connection pool
- [ ] N+1
- [ ] Cache
- [ ] Dữ liệu lớn
- [ ] Recovery sau quá tải

## 14. Quality Measurement

- [ ] Statement coverage
- [ ] Line coverage
- [ ] Function coverage
- [ ] Branch coverage
- [ ] Requirement coverage
- [ ] Critical scenario coverage
- [ ] Mutation critical logic
- [ ] Surviving mutants
- [ ] Uncovered code
- [ ] False positive/negative
- [ ] Flaky rate
- [ ] Escaped defects
- [ ] Execution time
- [ ] Không test vô nghĩa để tăng coverage

## 15. Test Review

- [ ] Đúng requirement
- [ ] Đủ critical scenarios
- [ ] Expected độc lập
- [ ] Assertion mạnh
- [ ] Không overmock
- [ ] Không phụ thuộc implementation
- [ ] Có giá trị sau refactor
- [ ] Phát hiện regression
- [ ] Skip có lý do
- [ ] Không disable để CI xanh
- [ ] Review test AI
- [ ] Thực sự chạy test
- [ ] Ghi rủi ro chưa test

## 16. CI/CD

- [ ] Lint/static analysis
- [ ] Type checking
- [ ] Unit pass
- [ ] Integration pass
- [ ] Critical E2E pass
- [ ] Coverage threshold
- [ ] Không giảm threshold tùy tiện
- [ ] Dependency scanning
- [ ] Secret scanning
- [ ] Production build
- [ ] Migration test
- [ ] Code/test approval
- [ ] Staging smoke
- [ ] Mutation định kỳ
- [ ] Performance/security theo risk
- [ ] Rollback

## 17. Production Feedback

- [ ] Error monitoring
- [ ] Structured logging
- [ ] Metrics/tracing
- [ ] Alerting
- [ ] Error rate/latency
- [ ] Root cause analysis
- [ ] Tái hiện bug
- [ ] Regression test
- [ ] Fail trước fix/pass sau fix
- [ ] Cập nhật scenario matrix
- [ ] Cập nhật risk
- [ ] Bỏ test dư thừa
- [ ] Sửa flaky thay vì chỉ retry
- [ ] Review strategy định kỳ

## 18. Tiêu chí bổ sung theo loại hệ thống

- [ ] CLI: exit code, stdout/stderr, signal, file permissions.
- [ ] Library/SDK: public API, compatibility, invalid input, resource cleanup.
- [ ] Mobile/desktop: lifecycle, offline, permissions, upgrade, platform compatibility.
- [ ] Data pipeline: schema, duplicate events, late data, replay, reconciliation.
- [ ] Distributed system: partition, ordering, clock skew, eventual consistency.
- [ ] Embedded: timing, hardware interface, power loss, resource constraints.
- [ ] Kiểm tra backward compatibility và upgrade/downgrade khi được hỗ trợ.
- [ ] Kiểm tra backup/restore và disaster recovery theo RPO/RTO.
- [ ] Ghi evidence, owner, trạng thái Pass/Fail/Not run/N/A cho tiêu chí áp dụng.
