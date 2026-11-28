# Guide 28: Tính thử và đặt đơn COD

## Hợp đồng API

API có tiền tố `/api/v1`. Khách vãng lai gọi không cần token; Customer có thể gửi Bearer token để gắn `user_id` vào quote và Order. Tài khoản nội bộ không được dùng checkout.

### 1. Tạo quote

`POST /api/v1/checkout/quote`

```json
{
  "items": [{ "variantId": "0193e4d4-0b53-7a8b-9f2d-c2a4dcab249f", "quantity": 2 }],
  "contactName": "Nguyen Van A",
  "contactPhone": "0901234567",
  "contactEmail": "buyer@example.com",
  "shippingProvinceCode": "79",
  "shippingWardCode": "26734",
  "shippingAddress": "123 Nguyen Hue",
  "voucherCode": "SALE10"
}
```

Response gồm `quoteId`, snapshot các dòng, số lượng bán được, Giá bán/giá khuyến mãi, Tạm tính, giảm Voucher, phí ship, tổng, quyền COD và `expiresAt`. Quote hết hạn sau 15 phút và không giữ hàng. Mỗi biến thể chỉ xuất hiện một lần, số lượng từ 1 đến 10.

### 2. Đặt COD

`POST /api/v1/checkout/orders/COD`

Header bắt buộc: `Idempotency-Key: <unique-key>`.

```json
{ "quoteId": "0193e4d4-0b53-7a8b-9f2d-c2a4dcab249f" }
```

Cùng key + cùng body trả lại response đã lưu; cùng key với body khác trả `409`. Quote thay đổi/hết hạn/đã dùng, thiếu hàng hoặc vượt hạn mức COD đều không tạo Order. Một transaction khóa dữ liệu, tính lại fingerprint, trừ tồn, ghi `awaiting_dispatch_items`, tạo Order + snapshot, ghi Voucher usage và lưu response idempotency.

## Giá trị mặc định

| Quy tắc                          |        Giá trị |
| -------------------------------- | -------------: |
| Quote TTL                        |        15 phút |
| Phí ship dự phòng                |     30.000 VND |
| Ngưỡng miễn phí ship sau Voucher |    500.000 VND |
| Hạn mức COD                      | 10.000.000 VND |

Tạm tính dùng giá khuyến mãi đang hiệu lực; Voucher chỉ giảm Tạm tính, phần giảm được phân bổ vào các dòng theo tỷ lệ. Số lượng bán được = `inventory.quantity - inventory.reserved_quantity`.

Các số tiền được trả về dưới dạng số nguyên JSON; quote vượt miền số nguyên an toàn của JavaScript bị từ chối để tránh sai lệch làm tròn.

## Kiểm thử và migration

```bash
npx prisma validate --config prisma7.config.ts
npx prisma migrate status --config prisma7.config.ts
npx prisma migrate deploy --config prisma7.config.ts
npm run prisma:generate
npx vitest run src/modules/checkout
npm run typecheck
npm run test
npm run build
npm run openapi:write
```

Khi GHN và Cart được triển khai, thay nguồn dòng hàng bằng Cart và thay phí dự phòng luôn dùng bằng phí GHN khi thành công; fallback vẫn giữ nguyên khi provider lỗi.
