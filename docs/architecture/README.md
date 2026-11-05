# Kiến trúc hệ thống

> Trạng thái: **Đang viết lại cho tái cấu trúc source** ([quy ước](../README.md#trạng-thái-tài-liệu)). Nguồn ưu tiên khi mâu thuẫn: [`../business/`](../business/) → [`../adr/`](../adr/) → thư mục này. Thuật ngữ theo [GLOSSARY.md](../../GLOSSARY.md).

## 1. Thứ tự đọc

| # | Tài liệu | Nội dung |
|---|---|---|
| 01 | [01-overview.md](./01-overview.md) | Bối cảnh, stack, sơ đồ hệ thống, nguyên tắc kiến trúc |
| 02 | [02-modules.md](./02-modules.md) | Các module, quyền sở hữu dữ liệu, cấu trúc thư mục, quy tắc phụ thuộc |
| 03 | [03-api.md](./03-api.md) | Request pipeline, `/api/v1`, nhóm route, định dạng lỗi, phân trang, idempotency |
| 04 | [04-data-consistency.md](./04-data-consistency.md) | Transaction, Giữ hàng, Hàng chờ xuất, row lock, các cuộc đua |
| 05 | [05-auth-security.md](./05-auth-security.md) | Xác thực, phân quyền, bảo mật, log và PII |
| 06 | [06-integrations.md](./06-integrations.md) | VNPay, MoMo, GHN, email, object storage |
| 07 | [07-async-events-jobs.md](./07-async-events-jobs.md) | Outbox, sự kiện, BullMQ, job định kỳ |
| 08 | [08-observability.md](./08-observability.md) | Log, metrics, tracing, cảnh báo |
| 09 | [09-deployment.md](./09-deployment.md) | Docker, CI/CD, topology, rollout |
| 10 | [10-nfr.md](./10-nfr.md) | Yêu cầu phi chức năng |
| 11 | [11-database.md](./11-database.md) | Schema mục tiêu: bảng, cột, ràng buộc, index |
| — | [modules/](./modules/) | Thiết kế chi tiết từng module: `identity`, `catalog`, `pricing`, `cart`, `inventory`, `ordering`, `payments`, `refunds-returns`, `fulfillment`, `notifications`, `compliance`, `admin-config` |

## 2. Quy ước viết

- Không chép lại quy tắc nghiệp vụ: trích mã `BR-*`, `US-*`, `ADR xxxx`.
- Tài liệu mô tả **kiến trúc mục tiêu** sau tái cấu trúc, không mô tả code cũ. Trạng thái implement theo dõi trên GitHub Issues.
- Quyết định khó đảo ngược ghi thành ADR ở [`../adr/`](../adr/), tài liệu ở đây chỉ link tới.
