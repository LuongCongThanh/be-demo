---
decision_status: accepted
implementation_status: implemented
decided_at: 2026-09-24
last_verified: 2026-09-24
related_spec: ../specs/03-products.md
---

# `PATCH /products/:id` là last-write-wins, không có optimistic version

`PATCH /products/:id` full-sync `images[]` và `variants[]`: phần tử vắng mặt trong mảng bị gỡ (ảnh bị xoá, variant thành Discontinued Variant). Khi hai staff cùng mở form edit một Product, người lưu sau ghi đè trọn danh sách bằng bản họ đã tải — ảnh/variant người trước vừa thêm bị gỡ **âm thầm**, không lỗi, không cảnh báo. Chấp nhận rủi ro này: catalog hiện do một số rất ít staff quản lý, tranh chấp edit cùng Product hiếm, và không muốn bắt FE giữ và gửi lại một giá trị `version` ở mọi request edit.

## Considered Options

- **Optimistic version**: Product có `version`, GET trả về, PATCH bắt buộc gửi lại; lệch → 409 "tải lại". Chặn được mất dữ liệu, đổi lại một field bắt buộc trong contract. Không dùng `updatedAt` thay thế vì nó không đổi khi PATCH chỉ đụng tới ảnh/variant. Row lock kiểu ADR 0009 không áp dụng được vì form edit mở trong nhiều phút.
- **Gửi thay đổi thay vì full-sync** (`add`/`remove`/`order`): không mất dữ liệu mà không cần version, nhưng contract phức tạp hơn và lệch với `variants[]`.

## Consequences

- Đây là rủi ro có chủ đích, không phải bug — không "sửa" bằng cách đổi sang merge ngầm. Race hẹp giữa lúc đọc và lúc ghi _trong cùng một request_ (ảnh đang giữ vừa bị request khác xoá) vẫn trả 409.
- Nâng lên optimistic version sau này không phá client cũ nếu làm hai bước: thêm `version` vào response và nhận `version` optional ở PATCH (có thì kiểm tra), rồi mới chuyển thành bắt buộc khi FE đã gửi.
