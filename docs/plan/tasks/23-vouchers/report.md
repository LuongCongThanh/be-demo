# Report 23

- **PR:** #92
- **Ngày merge:**

## Đã làm

- Model `Voucher`, enum `VoucherType`, migration `20261114090000_vouchers` (CHECK theo BR-VCH-03/04/09, cấp 2 Quyền cho Admin).
- `modules/voucher`: `AdminVoucherService` + controller; trạng thái tính lúc request (`voucherStatus`) và điều kiện lọc tương ứng (`voucherStatusWhere`, so `used_count` với `total_limit` bằng field reference).
- BR-VCH-11, US-901 AC3, `modules/pricing.md` §4.

## Kiểm tay (API local, DB docker throwaway)

- Tạo `sale…` → lưu `SALE…`, ACTIVE; tạo lại bằng chữ hoa → 409.
- % 120, FIXED kèm `maxDiscount`, mã "a b", kết thúc trước bắt đầu → 400.
- Voucher sắp diễn ra (UPCOMING); chưa dùng: đổi sang PERCENT 15% tối đa 40.000 → 200; `type: null` → 400; gửi `code` → 400.
- Lọc: `q`, `status=ACTIVE`, `UPCOMING`, `EXHAUSTED`, `DISABLED` đúng.
- Giả lập 3 lượt dùng (sửa `used_count` trong DB): sửa `value`, `minSubtotal` → 409; `totalLimit: 2` → 400; `totalLimit: 3`, `perBuyerLimit: 2`, kéo dài kết thúc → 200, trạng thái EXHAUSTED; xoá → 409; tắt → DISABLED. Xoá Voucher chưa dùng → 204.

## Lệch so với spec và rủi ro còn lại

- Chưa có `voucher_usages`; `used_count` luôn 0 cho tới slice C.
- Review (`/code-review`): sửa và xoá giờ chạy trong transaction có `SELECT … FOR UPDATE` (không đua với lượt dùng ở slice C); trường gửi lại giá trị cũ không bị coi là đổi (form gửi cả object vẫn bật/tắt được Voucher đã dùng — đã kiểm); đổi sang FIXED tự bỏ `maxDiscount`; `_`, `%` trong từ khoá tìm là ký tự thường; PATCH rỗng không ghi; `11-database.md` §4.3 cập nhật theo bảng thật.
- Thay đổi Voucher chưa ghi audit log.
