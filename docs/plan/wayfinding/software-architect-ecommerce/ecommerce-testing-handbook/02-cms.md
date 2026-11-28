# CMS và back-office

**Trạng thái:** Nháp (tài liệu tham khảo).

## Test inventory

Mỗi dòng là một scenario cần xác định expected result theo policy đã duyệt, không phải yêu cầu chạy ở mọi tầng.

| ID     | Scenario                        | Tầng ưu tiên                                    | Risk |
| ------ | ------------------------------- | ----------------------------------------------- | ---- |
| CMS-01 | Role matrix từng action         | Component hoặc Integration/API theo trách nhiệm | P1   |
| CMS-02 | staff không sửa quyền trái phép | Component hoặc Integration/API theo trách nhiệm | P1   |
| CMS-03 | bulk action partial failure     | Component hoặc Integration/API theo trách nhiệm | P1   |
| CMS-04 | import CSV lỗi dòng             | Component hoặc Integration/API theo trách nhiệm | P1   |
| CMS-05 | export không lộ PII             | Component hoặc Integration/API theo trách nhiệm | P1   |
| CMS-06 | publish/unpublish               | Component hoặc Integration/API theo trách nhiệm | P1   |
| CMS-07 | concurrent edit                 | Component hoặc Integration/API theo trách nhiệm | P1   |
| CMS-08 | audit actor/before/after        | Component hoặc Integration/API theo trách nhiệm | P1   |
| CMS-09 | search/filter/pagination        | Component hoặc Integration/API theo trách nhiệm | P1   |
| CMS-10 | destructive confirmation        | Component hoặc Integration/API theo trách nhiệm | P1   |
| CMS-11 | upload validation               | Component hoặc Integration/API theo trách nhiệm | P1   |
| CMS-12 | session expiry                  | Component hoặc Integration/API theo trách nhiệm | P1   |

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
