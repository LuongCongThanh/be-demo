---
status: done
pr:
blocked-by: [22-sale-prices]
labels: [ready-for-agent]
---

# Spec 23: Voucher (back-office)

Branch: `feature/vouchers` · Slice B2. Không viết test mới (Phase 7); xác minh bằng typecheck, lint, build, Swagger và chạy tay.

## Problem Statement

Chưa có Voucher (US-901): Admin không tạo, sửa hay vô hiệu hoá được mã giảm giá. Áp mã khi đặt đơn và đếm lượt dùng thuộc slice C (cần Đơn hàng).

## Solution

- Module `voucher`, bảng `vouchers` (enum `VoucherType` PERCENT/FIXED) với CHECK: mã in hoa, % 1–100, mức tối đa chỉ cho %, giới hạn > 0, kết thúc sau bắt đầu.
- Quyền `PRICING_VOUCHER_VIEW/MANAGE`, cấp cho Admin trong migration.
- `GET /admin/vouchers` (tìm theo mã, lọc trạng thái ACTIVE/UPCOMING/ENDED/EXHAUSTED/DISABLED), `GET/PATCH/DELETE /admin/vouchers/:id`, `POST /admin/vouchers`.
- BR-VCH-11 (mới): mã không đổi; chưa dùng thì sửa, xoá được; đã dùng chỉ đổi kết thúc, tổng lượt (≥ đã dùng), lượt mỗi người, bật/tắt.
- Sau khi merge: tag `openapi-v0.7.0`.

## Acceptance criteria

- Mã gửi chữ thường được lưu in hoa; trùng mã (kể cả khác hoa thường) → 409.
- % > 100, FIXED kèm mức tối đa, kết thúc trước bắt đầu, mã sai dạng → 400.
- Đã có lượt dùng: sửa giá trị → 409; tổng lượt dưới số đã dùng → 400; xoá → 409; vô hiệu hoá → DISABLED.
