# Danh mục, sản phẩm và SKU

**Trạng thái:** Nháp (tài liệu tham khảo).

## Test inventory

Mỗi dòng là một scenario cần xác định expected result theo policy đã duyệt, không phải yêu cầu chạy ở mọi tầng.

| ID         | Scenario                               | Tầng ưu tiên                                    | Risk |
| ---------- | -------------------------------------- | ----------------------------------------------- | ---- |
| CATALOG-01 | Slug unique theo locale                | Component hoặc Integration/API theo trách nhiệm | P1   |
| CATALOG-02 | category cycle và depth                | Component hoặc Integration/API theo trách nhiệm | P1   |
| CATALOG-03 | parent ẩn kéo theo subtree theo policy | Component hoặc Integration/API theo trách nhiệm | P1   |
| CATALOG-04 | primary category duy nhất              | Component hoặc Integration/API theo trách nhiệm | P1   |
| CATALOG-05 | SKU unique                             | Component hoặc Integration/API theo trách nhiệm | P1   |
| CATALOG-06 | biến thể màu/size hợp lệ               | Component hoặc Integration/API theo trách nhiệm | P1   |
| CATALOG-07 | giá âm bị từ chối                      | Component hoặc Integration/API theo trách nhiệm | P1   |
| CATALOG-08 | ảnh lỗi và alt                         | Component hoặc Integration/API theo trách nhiệm | P1   |
| CATALOG-09 | sản phẩm draft không public            | Component hoặc Integration/API theo trách nhiệm | P1   |
| CATALOG-10 | soft delete không phá lịch sử đơn      | Component hoặc Integration/API theo trách nhiệm | P1   |
| CATALOG-11 | SEO canonical/redirect                 | Component hoặc Integration/API theo trách nhiệm | P1   |
| CATALOG-12 | cập nhật đồng thời không ghi đè        | Component hoặc Integration/API theo trách nhiệm | P1   |

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
