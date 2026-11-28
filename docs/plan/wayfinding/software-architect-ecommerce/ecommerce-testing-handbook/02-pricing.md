# Giá, thuế, voucher và promotion

**Trạng thái:** Nháp (tài liệu tham khảo).

## Test inventory

Mỗi dòng là một scenario cần xác định expected result theo policy đã duyệt, không phải yêu cầu chạy ở mọi tầng.

| ID         | Scenario                             | Tầng ưu tiên    | Risk |
| ---------- | ------------------------------------ | --------------- | ---- |
| PRICING-01 | Giá server khác client               | Integration/API | P0   |
| PRICING-02 | làm tròn tiền                        | Integration/API | P0   |
| PRICING-03 | min spend ngay dưới/bằng/trên ngưỡng | Integration/API | P0   |
| PRICING-04 | voucher hết hạn đúng boundary        | Integration/API | P0   |
| PRICING-05 | timezone                             | Integration/API | P0   |
| PRICING-06 | quota đồng thời                      | Integration/API | P0   |
| PRICING-07 | giới hạn mỗi user                    | Integration/API | P0   |
| PRICING-08 | stacking                             | Integration/API | P0   |
| PRICING-09 | loại trừ SKU/category                | Integration/API | P0   |
| PRICING-10 | free shipping threshold              | Integration/API | P0   |
| PRICING-11 | discount cap                         | Integration/API | P0   |
| PRICING-12 | refund phân bổ discount              | Integration/API | P0   |
| PRICING-13 | thay đổi giá sau checkout            | Integration/API | P0   |

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
