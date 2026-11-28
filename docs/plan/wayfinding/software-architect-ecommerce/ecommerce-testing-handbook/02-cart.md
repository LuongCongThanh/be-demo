# Giỏ hàng

**Trạng thái:** Nháp (tài liệu tham khảo).

## Test inventory

Mỗi dòng là một scenario cần xác định expected result theo policy đã duyệt, không phải yêu cầu chạy ở mọi tầng.

| ID      | Scenario                    | Tầng ưu tiên                                    | Risk |
| ------- | --------------------------- | ----------------------------------------------- | ---- |
| CART-01 | Giỏ rỗng                    | Component hoặc Integration/API theo trách nhiệm | P1   |
| CART-02 | quantity 0/âm/quá giới hạn  | Component hoặc Integration/API theo trách nhiệm | P1   |
| CART-03 | SKU hết hàng                | Component hoặc Integration/API theo trách nhiệm | P1   |
| CART-04 | giá thay đổi                | Component hoặc Integration/API theo trách nhiệm | P1   |
| CART-05 | sản phẩm bị ẩn              | Component hoặc Integration/API theo trách nhiệm | P1   |
| CART-06 | guest merge khi login       | Component hoặc Integration/API theo trách nhiệm | P1   |
| CART-07 | giỏ người khác bị từ chối   | Component hoặc Integration/API theo trách nhiệm | P1   |
| CART-08 | cập nhật đồng thời          | Component hoặc Integration/API theo trách nhiệm | P1   |
| CART-09 | cache invalidation          | Component hoặc Integration/API theo trách nhiệm | P1   |
| CART-10 | refresh giữ giỏ theo policy | Component hoặc Integration/API theo trách nhiệm | P1   |
| CART-11 | double click                | Component hoặc Integration/API theo trách nhiệm | P1   |
| CART-12 | stale response không ghi đè | Component hoặc Integration/API theo trách nhiệm | P1   |

## Checklist review

- [ ] Happy path, negative, boundary và state transition phù hợp.
- [ ] Expected result xác định độc lập với implementation.
- [ ] API kiểm tra status, error code, response schema và quyền truy cập.
- [ ] Integration xác minh dữ liệu thực, side effects và không có thay đổi ngoài ý muốn.
- [ ] Test data độc lập, clock kiểm soát được, không dùng dữ liệu khách thật.
- [ ] Retry, concurrency, timeout được kiểm tra nếu có rủi ro.
- [ ] FE kiểm tra loading/error/empty/success nếu có UI.
- [ ] E2E chỉ giữ hành trình quan trọng và failure/recovery có giá trị.
- [ ] Traceability và bằng chứng thực thi được ghi nhận.
