# Hướng dẫn triển khai — Thanh toán online và đối soát

## Vị trí thay đổi

- Prisma schema: `prisma/schema/schema.prisma`, `prisma/schema/enums.prisma`; migration SQL trong `prisma/migrations/`.
- Checkout orchestration: `src/modules/checkout/checkout.module.ts`, controller, DTO và `CheckoutService`.
- Payment API và nghiệp vụ: module/service/controller trong `src/modules/payment/`.
- Gateway adapter: `src/infrastructure/payment/`; cấu hình tại `src/config/env.validation.ts` và `.env.example`.
- Job định kỳ cần idempotent giữa nhiều replica; mỗi lần xử lý Payment/Order phải khóa dòng DB và dùng cùng bộ xử lý với IPN.
- Kiểm thử: unit test cho service và gateway adapter; regression test cho checkout transaction; e2e cho endpoint checkout/IPN.

## Lưu ý triển khai

- Không gọi provider bên trong transaction DB. Ghi thay đổi nghiệp vụ và dedup record trong transaction riêng.
- Xác minh secure hash VNPay và chữ ký MoMo theo đúng thứ tự tham số, cách mã hóa và HMAC của provider; so sánh chữ ký theo cách constant-time.
- Tính hạn link từ `Order.placedAt`: mọi lần thử có cùng thời điểm hết hạn (+10 phút), không tạo lần thử mới từ phút thứ 7.
- Dùng mã giao dịch/sự kiện của provider làm cơ sở cho dedup key; unique constraint DB là lớp bảo vệ cuối.
- Khóa Payment và Order trước khi xác nhận số tiền; xử lý riêng khoản thu trùng, muộn hoặc sai tổng.
- Không ghi credential vào log, response hoặc fixture. Chỉ ghi nhận UAT sandbox khi đã thực sự chạy với tài khoản merchant hợp lệ.
