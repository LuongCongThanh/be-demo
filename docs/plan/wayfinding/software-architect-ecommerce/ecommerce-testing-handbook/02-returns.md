# Đổi trả và hậu mãi

**Trạng thái:** Nháp (tài liệu tham khảo).

## Test inventory

Mỗi dòng là một scenario cần xác định expected result theo policy đã duyệt, không phải yêu cầu chạy ở mọi tầng.

| ID         | Scenario                                    | Tầng ưu tiên    | Risk |
| ---------- | ------------------------------------------- | --------------- | ---- |
| RETURNS-01 | Ngoài thời hạn                              | Integration/API | P0   |
| RETURNS-02 | số lượng trả vượt mua                       | Integration/API | P0   |
| RETURNS-03 | trả một phần                                | Integration/API | P0   |
| RETURNS-04 | item không đủ điều kiện                     | Integration/API | P0   |
| RETURNS-05 | yêu cầu trùng                               | Integration/API | P0   |
| RETURNS-06 | refund theo snapshot và discount allocation | Integration/API | P0   |
| RETURNS-07 | restock đúng tình trạng                     | Integration/API | P0   |
| RETURNS-08 | quyền duyệt                                 | Integration/API | P0   |
| RETURNS-09 | audit                                       | Integration/API | P0   |
| RETURNS-10 | lỗi refund sau khi nhận hàng                | Integration/API | P0   |
| RETURNS-11 | trạng thái return/refund độc lập            | Integration/API | P0   |

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
