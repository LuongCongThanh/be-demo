Type: docs/research
Status: resolved

## Question

Những yêu cầu nào trong `docs/business/` đã hoàn thành, đang làm một phần, hoặc còn thiếu trên backend `be-demo`, CMS và storefront, khi đối chiếu cả code, test và task hiện hữu? Lập baseline có dẫn chứng tới vị trí code/test/task; không sửa code và không nhân đôi task 17, 24 hoặc 11.

## Answer

Nền tảng catalog/admin đã có implementation/test. Các khoảng trống tính năng đáng kể gồm nối auth với storefront, tích hợp locale của category xuyên CMS/store và xây dựng luồng commerce end-to-end. Baseline chi tiết cùng bằng chứng code/test/task nằm trong [báo cáo coverage](https://github.com/LuongCongThanh/be-demo/blob/research/mvp-coverage-baseline/research/mvp-coverage-baseline.md) trên nhánh docs/research.
