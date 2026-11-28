# Tài khoản và phân quyền

## Test inventory

Mỗi dòng là một scenario cần xác định expected result theo policy đã duyệt, không phải yêu cầu chạy ở mọi tầng.

| ID          | Scenario                        | Tầng ưu tiên    | Risk |
| ----------- | ------------------------------- | --------------- | ---- |
| ACCOUNTS-01 | Đăng ký email trùng             | Integration/API | P0   |
| ACCOUNTS-02 | xác minh token hết hạn/dùng lại | Integration/API | P0   |
| ACCOUNTS-03 | login sai và rate limit         | Integration/API | P0   |
| ACCOUNTS-04 | reset mật khẩu không lộ account | Integration/API | P0   |
| ACCOUNTS-05 | session revoke                  | Integration/API | P0   |
| ACCOUNTS-06 | refresh rotation                | Integration/API | P0   |
| ACCOUNTS-07 | OAuth account linking           | Integration/API | P0   |
| ACCOUNTS-08 | staff MFA nếu áp dụng           | Integration/API | P0   |
| ACCOUNTS-09 | RBAC từng action                | Integration/API | P0   |
| ACCOUNTS-10 | truy cập đơn người khác         | Integration/API | P0   |
| ACCOUNTS-11 | thay đổi email                  | Integration/API | P0   |
| ACCOUNTS-12 | logout và cache riêng tư        | Integration/API | P0   |

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
