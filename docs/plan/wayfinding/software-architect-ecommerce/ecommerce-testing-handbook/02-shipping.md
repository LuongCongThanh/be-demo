# Vận chuyển

**Trạng thái:** Nháp (tài liệu tham khảo).

## Test inventory

Mỗi dòng là một scenario cần xác định expected result theo policy đã duyệt, không phải yêu cầu chạy ở mọi tầng.

| ID          | Scenario                               | Tầng ưu tiên    | Risk |
| ----------- | -------------------------------------- | --------------- | ---- |
| SHIPPING-01 | Địa chỉ không phục vụ                  | Integration/API | P1   |
| SHIPPING-02 | phí theo trọng lượng                   | Integration/API | P1   |
| SHIPPING-03 | quote hết hạn                          | Integration/API | P1   |
| SHIPPING-04 | provider timeout                       | Integration/API | P1   |
| SHIPPING-05 | tạo shipment trùng                     | Integration/API | P1   |
| SHIPPING-06 | tracking webhook sai chữ ký nếu hỗ trợ | Integration/API | P1   |
| SHIPPING-07 | trạng thái đến sai thứ tự              | Integration/API | P1   |
| SHIPPING-08 | giao thất bại                          | Integration/API | P1   |
| SHIPPING-09 | COD đối soát                           | Integration/API | P1   |
| SHIPPING-10 | hủy shipment                           | Integration/API | P1   |
| SHIPPING-11 | retry                                  | Integration/API | P1   |
| SHIPPING-12 | phí thực tế lệch quote                 | Integration/API | P1   |

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
