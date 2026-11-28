# Frontend & Backend Testing

FE bảo vệ hành vi người dùng, UI, state và trải nghiệm. BE bảo vệ nghiệp vụ, dữ liệu, API, bảo mật, đồng thời và phục hồi. Full-stack bảo vệ tích hợp và hành trình hoàn chỉnh. Áp dụng độc lập công nghệ.

## FE: ưu tiên và kiến trúc

P0: component, integration, unit, critical E2E, security. P1: accessibility, visual regression, contract, cross-browser, performance. P2: mutation, property-based (nâng ưu tiên nếu rủi ro cao). Testing Trophy: static analysis (lint/types) → unit (pure logic) → component/integration (trọng tâm) → E2E (critical journeys). Không có tỷ lệ bắt buộc.

## FE Unit checklist

- [ ] Utility/helper functions; data transformation; business calculations.
- [ ] Form validation schema; date/currency/number formatting.
- [ ] Hooks/composables có logic; reducers/state transitions.
- [ ] Client permission logic; sorting/filtering/pagination.
- [ ] URL query parameters; API response mapping; error transformation; cache keys.

Không test getter/setter/constant/wrapper hoặc UI tĩnh chỉ để tăng coverage.

## FE Component checklist

- [ ] Render đúng dữ liệu; loading, empty, error, success.
- [ ] Click, hover, focus, keyboard; nhập liệu và validation.
- [ ] Submit thành công/thất bại; disabled; double click/submit.
- [ ] Conditional rendering; callback/event quan trọng.
- [ ] Null/undefined; nội dung dài, ký tự đặc biệt.
- [ ] Accessibility; cập nhật khi input đổi; cleanup subscription/listener.

### Login form example

| Case                     | Expected                            |
| ------------------------ | ----------------------------------- |
| Email rỗng/sai định dạng | Validation error tương ứng          |
| Password rỗng            | Required error                      |
| Dữ liệu hợp lệ           | Gửi request                         |
| Pending                  | Loading                             |
| Click liên tục           | Không gửi trùng ngoài ý muốn        |
| 401/500/timeout          | Lỗi phù hợp, phục hồi theo thiết kế |
| Thành công               | Điều hướng đúng                     |
| Enter/Tab                | Submit/focus đúng thứ tự            |

## FE Integration checklist

Page/feature → components/form/state → API client/cache/router → mock API theo contract hoặc test backend.

- [ ] Page gọi đúng API theo hành vi; response hiển thị chính xác.
- [ ] Form kết hợp validation và submission.
- [ ] Global state cập nhật; đồng bộ nhiều component.
- [ ] Cache invalidation; optimistic update và rollback.
- [ ] Search debounce; filter/sort/pagination; URL đồng bộ filter.
- [ ] Routing/navigation; auth state; protected routes.
- [ ] Request cũ không ghi đè mới; timeout/network failure.
- [ ] Session hết hạn; stale data/refetch.

## FE E2E

Critical journeys: register/login/logout/reset password; protected pages/roles; CRUD; routing/redirect/deep link; search/filter/sort/pagination; form submission; upload/download/export; checkout/payment/order; expired/refresh session; retry/network/server error.

- [ ] Hành vi thực tế; locator role/label/test ID ổn định, tránh CSS dễ đổi.
- [ ] Không hard-coded sleep; dữ liệu cô lập; không phụ thuộc thứ tự.
- [ ] Kiểm tra kết quả nghiệp vụ cuối cùng, không chỉ URL/toast.
- [ ] Screenshot/video/trace khi fail; kịch bản thất bại và phục hồi.
- [ ] Browser thật; critical full-stack E2E dùng backend/database test thật.

## FE bổ sung

Visual: layout, spacing, font, màu, responsive. Accessibility: keyboard, focus, ARIA, contrast, screen reader. Cross-browser: Chrome/Firefox/Safari/Edge theo phạm vi. Responsive: mobile/tablet/desktop. Performance: LCP, INP, CLS, bundle, memory. Security: XSS, unsafe rendering, token leakage. SSR: rendering/hydration. I18n: locale/timezone/currency/translation. Contract: schema/types/compatibility.

Công cụ minh họa: Jest/Vitest; React Testing Library; Vue Testing Library/Vue Test Utils; Angular TestBed; MSW; Playwright/Cypress; Chromatic/Percy; axe-core/Pa11y; Lighthouse/WebPageTest; StrykerJS; fast-check; Pact.

## BE: ưu tiên và kiến trúc

P0: unit, integration, database, API, security, concurrency, transaction khi áp dụng. P1: contract, performance, resilience, mutation, property-based. P2: chaos. Pyramid: domain unit → integration (DB/cache/queue) → API/contract → system E2E. Điều chỉnh theo rủi ro.

## BE Unit checklist

- [ ] Business rules, domain entities/value objects/services, application services/use cases.
- [ ] Input validation; business calculations, pricing, discount, tax.
- [ ] Permission logic; state transitions; error handling; data mapping.
- [ ] Date/time; invariants; boundaries; invalid inputs.
- [ ] Idempotency/retry decision logic; exception mapping.
      Ví dụ chuyển tiền: thành công, thiếu số dư, âm, 0, sai tiền tệ, giới hạn, làm tròn.

## BE Integration checklist

Runner → API handler/controller → service/use case → repository/infrastructure → DB/cache/queue thật trong môi trường cô lập.

- [ ] Service/repository; query; constraints; commit/rollback.
- [ ] Module communication; dependency injection.
- [ ] Cache read/write/invalidation; queue producer/consumer.
- [ ] Event đúng thời điểm; không mất event ngoài thiết kế; duplicate message.
- [ ] Email/notification; external API contract.
- [ ] Migration với dữ liệu hiện có; connection failure; consistency.

## BE API checklist

- [ ] Valid/invalid body; missing fields; invalid types; boundary; path/query params.
- [ ] Authentication; invalid/expired token; insufficient permissions; object-level authorization.
- [ ] Not found; duplicate resource; business violation.
- [ ] Status, body, schema, headers, error code.
- [ ] Pagination/filter/sort; rate limit; idempotency; concurrent requests.
- [ ] DB side effects; không lộ sensitive data; backward compatibility.
      Ví dụ POST resource: 201 thành công; 400 invalid; 401 thiếu token; 403 thiếu quyền; 404 resource liên quan; 409 duplicate; 429 rate limit; 500 internal failure theo contract. Retry cùng key không tạo trùng; DB lỗi không để dữ liệu dở dang.

## BE Database checklist

- [ ] PK/FK/unique/not null/check/default.
- [ ] Commit/rollback/atomicity/consistency/isolation.
- [ ] Locking/deadlock/concurrent update/lost update/duplicate prevention.
- [ ] Cascade/soft delete; migration; precision/decimal/money/timezone.
- [ ] Index/query performance; pagination consistency; backup/restore verification.

## BE Concurrency & Resilience

Concurrent requests: tránh race; duplicate: không lặp nghiệp vụ; lost update: không ghi đè; DB failure: không sai dữ liệu; cache failure: fallback; queue failure: retry/recovery; external timeout: không lặp side effect; duplicate webhook: idempotency; out-of-order events: state hợp lệ; partial failure: rollback/compensation; restart: không mất dữ liệu đã cam kết; deadlock: retry hoặc lỗi an toàn; traffic spike: chịu tải theo giới hạn; network partition: consistency theo thiết kế.

## BE Security

Authentication (login/token/session/MFA); authorization (RBAC/ABAC); object authorization (IDOR/BOLA); SQL/command injection; sensitive data; rate limit/mass assignment; upload type/size/content; webhook signature/replay; SSRF/TLS; session expiration/revocation/rotation; privilege escalation/business bypass; log không chứa secret. FE ẩn button không thay thế BE authorization.

Công cụ: Jest/Vitest, pytest/unittest, JUnit/Mockito, xUnit/NUnit, Go testing/testify, PHPUnit/Pest, Cargo Test; Supertest/REST Assured/Postman; Testcontainers/Docker; Pact; k6/JMeter/Gatling/Locust; OWASP ZAP/Burp Suite; Stryker/PIT/mutmut; Hypothesis/fast-check/jqwik; Toxiproxy; Chaos Mesh/LitmusChaos.

## So sánh và phân bổ

FE: component, UI state, visual, accessibility, browser, rendering; BE: domain, database, transaction, throughput, recovery; cả hai: unit, integration, security, contract, concurrency, performance, mutation/property-based và critical E2E theo trách nhiệm. FE là API consumer, BE provider. Phân bổ công sức functional test minh họa: FE unit 20%, component 30%, integration 35%, E2E 15%; BE unit 40%, integration/DB 35%, API/contract 20%, system E2E 5%. Không phải coverage hay quota; non-functional có ngân sách riêng.

## Checkout responsibility matrix

| Scenario                | FE               | BE                      |
| ----------------------- | ---------------- | ----------------------- |
| Cart rỗng               | Disable checkout | Reject                  |
| Quantity invalid        | Form validation  | Business validation     |
| Thiếu stock             | Hiển thị lỗi     | Kiểm tra stock thật     |
| Tổng tiền               | Hiển thị         | Tính giá chính thức     |
| Voucher hết hạn         | Hiển thị lỗi     | Xác minh                |
| Double submit           | Chặn UI          | Idempotency             |
| Payment success/failure | Success/error UI | Xác minh/cập nhật state |
| Timeout                 | Retry UI         | Retry an toàn           |
| Hai người mua món cuối  | Hiển thị kết quả | Chống overselling       |
| Thiếu quyền             | Ẩn chức năng     | Reject                  |
| Rollback                | Hiển thị lỗi     | Data integrity          |
| Checkout hoàn chỉnh     | Full-stack E2E   | Full-stack E2E          |

## Definition of Done

FE: [ ] requirements/AC; [ ] unit logic; [ ] component behavior; [ ] feature integration; [ ] loading/empty/error/success; [ ] validation/error; [ ] state/cache; [ ] contract; [ ] responsive/browser; [ ] accessibility; [ ] security; [ ] critical E2E; [ ] performance; [ ] assertion review; [ ] coverage; [ ] CI gates.

BE: [ ] requirements/rules; [ ] domain unit; [ ] real integration; [ ] API happy/negative; [ ] boundary/edge; [ ] constraints/integrity; [ ] transaction/rollback; [ ] concurrency; [ ] idempotency; [ ] auth; [ ] security; [ ] timeout/retry/recovery; [ ] contract; [ ] mutation khi phù hợp; [ ] SLO; [ ] coverage; [ ] CI gates; [ ] monitoring/regression.

Tổ chức docs/testing/frontend và backend theo strategy, architecture, master checklist, từng loại test và DoD; shared gồm fullstack strategy, responsibility matrix, data, assertions, mutation, property-based, quality gates, AI guidelines. N/A phải có lý do. FE đảm bảo hành vi người dùng; BE đảm bảo nghiệp vụ/dữ liệu; full-stack đảm bảo toàn hệ thống.
