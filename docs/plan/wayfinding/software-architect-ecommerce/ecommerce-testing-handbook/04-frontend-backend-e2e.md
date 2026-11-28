# Trách nhiệm FE, BE và E2E

| Scenario         | FE                       | BE                            | E2E                    |
| ---------------- | ------------------------ | ----------------------------- | ---------------------- |
| Form địa chỉ     | Validation, focus, error | Schema, vùng phục vụ          | Checkout hợp lệ        |
| Giá thay đổi     | Hiển thị quote mới       | Tính lại từ nguồn tin cậy     | Một luồng giá thay đổi |
| Double submit    | Disable / pending        | Idempotency                   | Một đơn sau retry      |
| Hết tồn          | Thông báo và phục hồi    | Atomic reservation            | Một luồng hết tồn      |
| Payment fail     | Error/retry UX           | State, ledger, reconciliation | Fail rồi retry         |
| Staff permission | Ẩn action phù hợp        | Enforce quyền từng resource   | Staff role smoke       |

## FE checklist

- [ ] Component behavior, keyboard, accessibility, responsive, visual regression theo rủi ro.
- [ ] Loading/empty/error/success; stale requests, cache, optimistic rollback.
- [ ] Cart/checkout giữ state đúng khi reload, back/forward, session hết hạn.
- [ ] SEO: metadata, canonical, robots, sitemap, structured data và SSR nếu áp dụng.
- [ ] Locale, currency, timezone, ảnh chậm, mạng yếu, browser/device matrix.
- [ ] Không dùng snapshot lớn hoặc test CSS class vô nghĩa.

## BE checklist

- [ ] Domain invariants, boundary, decision table, state transitions.
- [ ] API schema, auth, object ownership, pagination, error mapping.
- [ ] Real DB constraints, transaction, rollback, locking, migrations.
- [ ] Cache/queue/outbox, retry, idempotency, contract và sandbox provider.
- [ ] Security, performance, resilience, observability.

## Critical E2E suite

| ID  | Journey                                        | Assertion cuối                          |
| --- | ---------------------------------------------- | --------------------------------------- |
| E01 | Browse → SKU → cart → checkout → online pay    | Một order, payment verified, stock đúng |
| E02 | COD checkout                                   | Order đúng policy, không giả paid       |
| E03 | Payment fail → retry                           | Không double charge/order               |
| E04 | Out of stock / price changed                   | Không tạo đơn sai, UX phục hồi          |
| E05 | Staff xử lý đơn → shipment → customer tracking | Trạng thái nhất quán                    |
| E06 | Return → refund                                | Ledger, stock và trạng thái đúng policy |
| E07 | Customer/staff unauthorized access             | Không lộ hoặc sửa dữ liệu               |

Dùng sandbox hoặc fake provider theo contract; E2E full-stack chạy backend và DB test thật. Không dùng tiền thật. Kiểm tra DB/API qua interface hỗ trợ test khi cần, không chỉ toast.
