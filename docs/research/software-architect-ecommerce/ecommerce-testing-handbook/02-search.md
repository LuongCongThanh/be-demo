# Tìm kiếm, review và notification

**Trạng thái:** Nháp (tài liệu tham khảo).

## Test inventory

Mỗi dòng là một scenario cần xác định expected result theo policy đã duyệt, không phải yêu cầu chạy ở mọi tầng.

| ID        | Scenario                                  | Tầng ưu tiên                                    | Risk |
| --------- | ----------------------------------------- | ----------------------------------------------- | ---- |
| SEARCH-01 | Search tiếng Việt có dấu                  | Component hoặc Integration/API theo trách nhiệm | P1   |
| SEARCH-02 | filter kết hợp                            | Component hoặc Integration/API theo trách nhiệm | P1   |
| SEARCH-03 | sort ổn định                              | Component hoặc Integration/API theo trách nhiệm | P1   |
| SEARCH-04 | pagination không trùng                    | Component hoặc Integration/API theo trách nhiệm | P1   |
| SEARCH-05 | index cập nhật sau publish                | Component hoặc Integration/API theo trách nhiệm | P1   |
| SEARCH-06 | review chỉ người đủ điều kiện theo policy | Component hoặc Integration/API theo trách nhiệm | P1   |
| SEARCH-07 | moderation                                | Component hoặc Integration/API theo trách nhiệm | P1   |
| SEARCH-08 | XSS nội dung                              | Component hoặc Integration/API theo trách nhiệm | P1   |
| SEARCH-09 | email gửi trùng                           | Component hoặc Integration/API theo trách nhiệm | P1   |
| SEARCH-10 | queue retry                               | Component hoặc Integration/API theo trách nhiệm | P1   |
| SEARCH-11 | unsubscribe marketing                     | Component hoặc Integration/API theo trách nhiệm | P1   |
| SEARCH-12 | template locale                           | Component hoặc Integration/API theo trách nhiệm | P1   |
| SEARCH-13 | không lộ dữ liệu trong email              | Component hoặc Integration/API theo trách nhiệm | P1   |

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
