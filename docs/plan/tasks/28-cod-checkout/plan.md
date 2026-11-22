# Plan 28: Tính thử và đặt đơn COD

## Mục tiêu

Hoàn thiện đường đi từ yêu cầu tính giá đến đặt đơn COD: quote có hạn 15 phút, giá/tồn kho/Voucher được tính lại tại lúc đặt, tồn kho và Hàng chờ xuất thay đổi nguyên tử, retry an toàn bằng `Idempotency-Key`.

## Phạm vi triển khai

1. Mở rộng schema Order để lưu đơn Guest/Customer và snapshot dòng hàng; thêm `CheckoutQuote`, `IdempotencyKey`, `VoucherUsage` và `AwaitingDispatchItem`.
2. Tạo migration tương thích dữ liệu Order legacy; giữ các migration đã áp dụng bất biến.
3. Thêm `POST /api/v1/checkout/quote` và `POST /api/v1/checkout/orders/COD`, DTO validation, OpenAPI và xác thực Customer tuỳ chọn.
4. Tính giá khuyến mãi, Voucher, phí ship dự phòng, hạn mức COD; so fingerprint và ghi Order trong một transaction.
5. Thêm unit test cho phép tính và service; cập nhật module docs, guide, report, metric và bảng kế hoạch.
6. Chạy Prisma validation/migration, lint, typecheck, unit tests, OpenAPI và build; sau khi hoàn tất mới push và tạo PR.

## Rủi ro và quyết định

- Task 26 (Cart) và Task 27 (quản lý Inventory) chưa có API/service; để không chặn vertical slice, quote nhận các dòng Biến thể trực tiếp. Khi Cart hoàn tất, chỉ thay nguồn `items`; không giữ hàng ở bước quote.
- GHN chưa được tích hợp; dùng fallback cố định 30.000đ và ghi `shipping_fee_fallback`. Ngưỡng miễn phí ship mặc định 500.000đ, hạn mức COD mặc định 10.000.000đ.
- Các thay đổi nhiều bảng chỉ dùng `tx`; khóa Biến thể, tồn kho, quote và Voucher theo thứ tự ổn định. Idempotency response chỉ được commit cùng Order.
