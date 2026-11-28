# Report 28

- **PR:** [#120](https://github.com/LuongCongThanh/be-demo/pull/120)
- **Trạng thái:** Hoàn tất vertical slice COD; tiếp tục theo dõi các tích hợp Cart/GHN.

## Đã làm

- Thêm `CheckoutQuote`, `IdempotencyKey`, `VoucherUsage`, `AwaitingDispatchItem` và mở rộng Order/OrderItem cho Customer/Guest, địa chỉ giao hàng, số tiền VND và snapshot dòng hàng.
- Hai migration mở rộng Order tương thích dữ liệu legacy và thêm Hàng chờ xuất; Prisma schema/client đã đồng bộ với PostgreSQL.
- Thêm `POST /api/v1/checkout/quote` và `POST /api/v1/checkout/orders/COD`, validation, xác thực Customer tuỳ chọn và hợp đồng OpenAPI.
- Quote lưu fingerprint trong 15 phút; giá khuyến mãi, tồn khả dụng, Voucher, phí ship và tổng được tính lại lúc đặt. Giao dịch đặt COD khoá dữ liệu liên quan, trừ tồn, ghi Hàng chờ xuất/Order/Voucher usage và response idempotency nguyên tử.
- Phép tính tiền dùng số nguyên chính xác; từ chối quote vượt miền số an toàn của hợp đồng API thay vì làm tròn im lặng.
- Kết thúc Sale Price cũng khoá Biến thể và đọc lại trạng thái trong transaction để không đua với checkout đang xác nhận giá.
- Dùng fallback phí ship 30.000đ, miễn ship từ 500.000đ sau Voucher, hạn mức COD mặc định 10.000.000đ. Cập nhật các quy tắc nghiệp vụ, hướng dẫn, kế hoạch và tài liệu module ordering.

## Xác minh

- `npx prisma validate --config prisma7.config.ts`: pass.
- `npx prisma migrate deploy --config prisma7.config.ts`: pass; 21 migrations applied.
- `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema --exit-code --config prisma7.config.ts`: no difference.
- `npx vitest run src/modules/checkout`: 2 files, 12 tests pass.
- Checkout e2e với PostgreSQL: 1 file, 4 tests pass (Guest, Customer, concurrent idempotency, stale quote, Voucher usage/COD limit).
- `npm run test`: 45 files, 315 tests pass.
- `npm run typecheck`, `npm run lint`, `npm run build`, `npm run openapi:write`: pass. Lint có một warning có sẵn ngoài task tại `email-throttler.guard.ts`.

## Phạm vi còn lại

- Task 26 chưa có Cart backend nên request quote nhận dòng hàng trực tiếp; sau này thay nguồn dòng bằng Cart.
- GHN chưa tích hợp; slice này luôn dùng và ghi cờ phí dự phòng, chưa xác minh mã tỉnh/phường hay cấu hình phí từ Admin.
- Việc gắn Guest Order theo email đã xác thực, email xác nhận đơn và vòng đời huỷ/thu COD thuộc các task identity/notification/payment tiếp theo.
