# Software Testing Quality Assessment

5 mục tiêu: correctness, fault detection, reliability, maintainability, efficiency. Không chỉ dựa vào số lượng test, coverage hoặc CI xanh.

## 15 tiêu chí và checklist (trọng số đề xuất)

### 1. Requirement Coverage — 10%

- [ ] Requirements rõ ràng.
- [ ] Mapping business rules với tests.
- [ ] Acceptance criteria được test.
- [ ] Traceability matrix.
- [ ] Critical rules đã biết được test.
- [ ] Ghi nhận yêu cầu chưa test.

### 2. Risk Coverage — 10%

- [ ] Risk assessment từng module.
- [ ] Phân loại likelihood/impact.
- [ ] Critical flows.
- [ ] Data loss/business correctness.
- [ ] Security/authorization.
- [ ] Concurrency/failure.
- [ ] Ưu tiên theo risk.

### 3. Fault Detection — 12%

- [ ] Mutation testing critical logic.
- [ ] Surviving mutants analysis.
- [ ] Phát hiện sai điều kiện.
- [ ] Phát hiện sai công thức.
- [ ] Phát hiện thiếu validation.
- [ ] Phát hiện sai state transition.
- [ ] Regression tái hiện bug.
- [ ] Bằng chứng FAIL khi đưa lỗi có chủ đích.

### 4. Assertion Quality — 10%

- [ ] Expected result chính xác.
- [ ] Không chỉ toBeDefined/toBeTruthy.
- [ ] Business state.
- [ ] Side effects.
- [ ] Dữ liệu không được thay đổi.
- [ ] Hành động không được phép.
- [ ] Expected độc lập implementation.
- [ ] Không làm yếu assertion để PASS.

### 5. Test Design — 8%

- [ ] Happy path.
- [ ] Negative.
- [ ] Boundary.
- [ ] Equivalence partitioning.
- [ ] Edge cases.
- [ ] Decision table khi phù hợp.
- [ ] State transition khi phù hợp.
- [ ] Property-based cho invariants.
- [ ] Expected result xác định trước.
- [ ] Tổ hợp rủi ro cao.

### 6. Test Architecture — 6%

- [ ] Unit cho logic độc lập.
- [ ] Integration cho tương tác thật.
- [ ] Component cho UI.
- [ ] API/contract cho giao tiếp.
- [ ] E2E cho critical journeys.
- [ ] Lowest effective level.
- [ ] Không test mọi thứ mọi tầng.
- [ ] Strategy rõ ràng.

### 7. Code Coverage — 4%

- [ ] Line.
- [ ] Branch.
- [ ] Function.
- [ ] Phân tích uncovered code.
- [ ] Ưu tiên risk cao.
- [ ] Không test vô nghĩa vì coverage.

### 8. Integration Fidelity — 8%

- [ ] Không mock logic đang test.
- [ ] Không over-mock internal services.
- [ ] Real DB khi phù hợp.
- [ ] Real cache/queue khi có risk.
- [ ] Transaction/rollback thật.
- [ ] External mock theo contract.
- [ ] Dependency timeout/failure.
- [ ] Môi trường phản ánh production quan trọng.

### 9. Reliability — 7%

- [ ] Độc lập.
- [ ] Không phụ thuộc thứ tự.
- [ ] Tái tạo được.
- [ ] Clock/timezone/seed.
- [ ] Không hard-coded sleep tùy tiện.
- [ ] Không flaky nghiêm trọng chưa xử lý.
- [ ] Không retry che lỗi.
- [ ] Parallel an toàn.

### 10. Maintainability — 5%

- [ ] Tên mô tả behavior.
- [ ] AAA/Given–When–Then.
- [ ] Dễ đọc.
- [ ] Không phụ thuộc implementation details.
- [ ] Factory/fixture hợp lý.
- [ ] Refactor không đổi behavior không gây fail vô lý.
- [ ] Failure message hữu ích.
- [ ] Review như production code.

### 11. Efficiency — 5%

- [ ] Không duplicate vô ích.
- [ ] Không lạm dụng E2E.
- [ ] Không test lại framework.
- [ ] Không trivial test vì coverage.
- [ ] Parameterized khi phù hợp.
- [ ] Theo dõi runtime.
- [ ] Execution strategy.
- [ ] Audit tối ưu định kỳ.

### 12. Non-functional — 5%

- [ ] Auth.
- [ ] Security vulnerabilities.
- [ ] Performance theo SLO.
- [ ] Concurrency/race khi có risk.
- [ ] Timeout/retry/idempotency.
- [ ] Recovery.
- [ ] Accessibility nếu UI.
- [ ] Migration/recovery khi áp dụng.

### 13. Test Data — 3%

- [ ] Valid/invalid.
- [ ] Boundary/special.
- [ ] Isolation.
- [ ] Cleanup.
- [ ] Không secret/PII production.
- [ ] Seed tái tạo.
- [ ] Dữ liệu thực tế.

### 14. CI/CD Gates — 4%

- [ ] Tự động chạy.
- [ ] Critical tests pass.
- [ ] Coverage threshold phù hợp.
- [ ] Static/security scan.
- [ ] Không bypass tùy tiện.
- [ ] PR/nightly/release strategy.
- [ ] Post-deploy smoke.
- [ ] Rollback.

### 15. Production Feedback — 3%

- [ ] Monitoring/observability.
- [ ] Escaped defects.
- [ ] RCA.
- [ ] Regression cho bug khi khả thi.
- [ ] Cập nhật risk sau sự cố.
- [ ] Review strategy.
- [ ] Ghi nhận remaining risks.

Tổng 100%. Requirement, risk, fault detection, assertion chiếm 42%; code coverage 4%. Đây là rubric đề xuất, không phải chuẩn ngành. Mỗi mục ghi PASS/FAIL/N/A/Not Assessed và evidence; N/A cần lý do.

## Metrics

| Metric                             | Minimum tham khảo | Target              |
| ---------------------------------- | ----------------- | ------------------- |
| Line/branch/function coverage      | 80%               | 90–95%              |
| Mutation score                     | 75%               | 85–95%              |
| Known requirement coverage         | 95%               | 100%                |
| Known critical risk/rule coverage  | 100%              | 100%                |
| Critical E2E pass                  | 100%              | 100%                |
| Flaky rate                         | <1%               | tiến tới 0%         |
| Known critical security issues     | 0                 | 0                   |
| Known critical regression coverage | 100%              | 100%                |
| Duplicate                          | Audit             | tối thiểu cần thiết |
| Maintenance cost                   | Theo dõi          | giảm lãng phí       |
| CI feedback                        | Time budget       | nhanh hợp lý        |
| Escaped defects                    | Theo dõi          | xu hướng giảm       |

Requirement coverage = requirements được kiểm thử / tổng requirements đã xác định ×100. Ví dụ 70/100 =70% dù code coverage 100%. Mutation score = mutants phát hiện / mutants hợp lệ được đánh giá ×100; theo quy ước công cụ, xử lý equivalent mutants và execution errors. Ví dụ `return stock >= quantity` bị đổi thành `stock > quantity`; cases (10,5,true), (10,10,true), (10,11,false); case bằng nhau phát hiện mutant. Escaped defects cần xét severity, release scope, usage. Flaky là pass/fail khi code và điều kiện không đổi. Efficiency xét thời gian viết/chạy/bảo trì, infra, điều tra fail và giá trị phát hiện lỗi; không có công thức duy nhất.

## Scorecard

Rating 0: nonexistent; 1: initial; 2: basic; 3: defined; 4: managed; 5: optimized. Score = sum(rating/5 × weight). Nếu N/A hợp lệ, chuẩn hóa theo tổng trọng số áp dụng: 100 × sum(rating/5 × weight)/sum(applicable weights). Not Assessed không được coi là N/A; báo điểm tạm tính và độ đầy đủ, không xác nhận điểm cuối khi thiếu evidence.
90–100 Excellent; 80–<90 Very Good; 70–<80 Good; 60–<70 Needs Improvement; 40–<60 Poor; <40 Critical. Điểm không thay thế release gates.

## Critical gates

- [ ] Không bỏ sót known critical business rule.
- [ ] Không known unresolved critical security vulnerability.
- [ ] Không unresolved serious data integrity defect.
- [ ] Critical journeys bắt buộc PASS.
- [ ] Auth được kiểm tra khi áp dụng.
- [ ] Transaction/rollback khi có risk.
- [ ] Concurrency/idempotency khi có risk.
- [ ] Không unresolved flaky trong critical suite.
- [ ] Không bypass trái quy định.
- [ ] Có evidence thực thi.
- [ ] Remaining risks được ghi nhận/đánh giá trước release.
      Không dùng điểm cao để bù gate fail.

## So sánh giả định

| Metric                                                                                                   | A coverage-driven | B over-testing | C optimized |
| -------------------------------------------------------------------------------------------------------- | ----------------- | -------------- | ----------- |
| Score minh họa                                                                                           | 58                | 72             | 94          |
| Test count                                                                                               | 5000              | 12000          | 3500        |
| Code coverage                                                                                            | 100%              | 100%           | 92%         |
| Branch                                                                                                   | 90%               | 98%            | 91%         |
| Mutation                                                                                                 | 45%               | 75%            | 93%         |
| Requirement                                                                                              | 65%               | 90%            | 100%        |
| Critical risk                                                                                            | 60%               | 95%            | 100%        |
| Flaky                                                                                                    | 5%                | 8%             | 0.1%        |
| CI                                                                                                       | 30m               | 120m           | 15m         |
| Bugs/month                                                                                               | 18                | 9              | 2           |
| Maintenance                                                                                              | Cao               | Rất cao        | Thấp        |
| Assertion                                                                                                | Yếu               | Khá            | Tốt         |
| Duplication                                                                                              | Cao               | Rất cao        | Thấp        |
| Giả định phạm vi, risk, release tương đương; điểm không được tính từ bảng này vì thiếu rating từng nhóm. |

## FE/BE assessment

FE ưu tiên user/component behavior, UI states, integration, contract, request race, visual, accessibility, responsive/browser, rendering performance, recovery UI, critical E2E. Checklist: behavior thay implementation; loading/empty/error/success; form/validation/interaction; state/cache; API/contract; race; accessibility/responsive; critical journeys; không lạm dụng snapshot/E2E; refactor không fail vô lý.
BE ưu tiên business rules/invariants, API, real infra, DB integrity, transactions, concurrency, auth/security, idempotency/retry/timeout, recovery, không over-mock. Cả hai cần mutation, performance, contract, E2E theo risk; visual/browser thường N/A cho BE.

## Audit workflow

1. Requirements/AC.
2. Risks.
3. Inventory theo module/layer/purpose.
4. Traceability.
5. Review assertion/mock/data/design.
6. Execute suite.
7. Code/branch/requirement coverage.
8. Mutation.
9. Duplication/wrong layer.
10. Reliability/flaky/reproducibility.
11. Cost/runtime.
12. Score.
13. Critical gates.
14. Prioritized roadmap.

## Maturity model

1 Ad-hoc: tùy hứng. 2 Basic: unit/E2E/coverage cơ bản. 3 Structured: strategy/architecture/checklist/CI. 4 Risk-based: requirements/risk/traceability/assertions. 5 Quality-driven: mutation/reliability/security/performance phù hợp. 6 Optimized: cân bằng cost/fault detection, production feedback. Đề xuất hướng tới 4–6 theo risk; không phải TMMi chính thức.

## 10 tiêu chuẩn cuối

Đúng/đủ nghiệp vụ; bảo vệ critical risk; fail khi sai; assertion mạnh; đúng tầng; phản ánh hệ thống thật; ổn định/độc lập/tái tạo; dễ bảo trì/không thừa; ngăn lỗi nghiêm trọng release; cải tiến từ production.

## Tổ chức tài liệu

quality-assessment/: README, testing-quality-framework, testing-quality-metrics, testing-quality-scorecard, testing-audit-checklist, testing-maturity-model, critical-quality-gates, requirement-coverage-assessment, risk-coverage-assessment, fault-detection-assessment, assertion-quality-assessment, test-efficiency-assessment, frontend-quality-assessment, backend-quality-assessment, testing-audit-report-template, testing-improvement-roadmap.
