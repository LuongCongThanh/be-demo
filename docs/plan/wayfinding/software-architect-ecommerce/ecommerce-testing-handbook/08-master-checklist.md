# Master checklist theo module

Đánh dấu chỉ khi có evidence; N/A cần lý do. Các scenario dưới đây là inventory khởi đầu, không phải số lượng test bắt buộc.

## Tài khoản và phân quyền (P0)

- [ ] ACCOUNTS-01: Đăng ký email trùng
- [ ] ACCOUNTS-02: xác minh token hết hạn/dùng lại
- [ ] ACCOUNTS-03: login sai và rate limit
- [ ] ACCOUNTS-04: reset mật khẩu không lộ account
- [ ] ACCOUNTS-05: session revoke
- [ ] ACCOUNTS-06: refresh rotation
- [ ] ACCOUNTS-07: OAuth account linking
- [ ] ACCOUNTS-08: staff MFA nếu áp dụng
- [ ] ACCOUNTS-09: RBAC từng action
- [ ] ACCOUNTS-10: truy cập đơn người khác
- [ ] ACCOUNTS-11: thay đổi email
- [ ] ACCOUNTS-12: logout và cache riêng tư

## Danh mục, sản phẩm và SKU (P1)

- [ ] CATALOG-01: Slug unique theo locale
- [ ] CATALOG-02: category cycle và depth
- [ ] CATALOG-03: parent ẩn kéo theo subtree theo policy
- [ ] CATALOG-04: primary category duy nhất
- [ ] CATALOG-05: SKU unique
- [ ] CATALOG-06: biến thể màu/size hợp lệ
- [ ] CATALOG-07: giá âm bị từ chối
- [ ] CATALOG-08: ảnh lỗi và alt
- [ ] CATALOG-09: sản phẩm draft không public
- [ ] CATALOG-10: soft delete không phá lịch sử đơn
- [ ] CATALOG-11: SEO canonical/redirect
- [ ] CATALOG-12: cập nhật đồng thời không ghi đè

## Giỏ hàng (P1)

- [ ] CART-01: Giỏ rỗng
- [ ] CART-02: quantity 0/âm/quá giới hạn
- [ ] CART-03: SKU hết hàng
- [ ] CART-04: giá thay đổi
- [ ] CART-05: sản phẩm bị ẩn
- [ ] CART-06: guest merge khi login
- [ ] CART-07: giỏ người khác bị từ chối
- [ ] CART-08: cập nhật đồng thời
- [ ] CART-09: cache invalidation
- [ ] CART-10: refresh giữ giỏ theo policy
- [ ] CART-11: double click
- [ ] CART-12: stale response không ghi đè

## Giá, thuế, voucher và promotion (P0)

- [ ] PRICING-01: Giá server khác client
- [ ] PRICING-02: làm tròn tiền
- [ ] PRICING-03: min spend ngay dưới/bằng/trên ngưỡng
- [ ] PRICING-04: voucher hết hạn đúng boundary
- [ ] PRICING-05: timezone
- [ ] PRICING-06: quota đồng thời
- [ ] PRICING-07: giới hạn mỗi user
- [ ] PRICING-08: stacking
- [ ] PRICING-09: loại trừ SKU/category
- [ ] PRICING-10: free shipping threshold
- [ ] PRICING-11: discount cap
- [ ] PRICING-12: refund phân bổ discount
- [ ] PRICING-13: thay đổi giá sau checkout

## Tồn kho (P0)

- [ ] INVENTORY-01: SKU cuối cùng có hai người mua
- [ ] INVENTORY-02: reservation hết hạn
- [ ] INVENTORY-03: release lặp
- [ ] INVENTORY-04: fulfillment lặp
- [ ] INVENTORY-05: điều chỉnh kho đồng thời
- [ ] INVENTORY-06: rollback khi tạo đơn lỗi
- [ ] INVENTORY-07: tồn không âm
- [ ] INVENTORY-08: stock ledger khớp
- [ ] INVENTORY-09: cache stale
- [ ] INVENTORY-10: trả hàng chỉ restock theo policy
- [ ] INVENTORY-11: worker restart
- [ ] INVENTORY-12: deadlock retry

## Checkout và đơn hàng (P0)

- [ ] CHECKOUT-01: Giỏ rỗng
- [ ] CHECKOUT-02: địa chỉ thiếu
- [ ] CHECKOUT-03: phí ship đổi
- [ ] CHECKOUT-04: voucher hết hạn
- [ ] CHECKOUT-05: server tính lại tổng
- [ ] CHECKOUT-06: double submit
- [ ] CHECKOUT-07: cùng idempotency key khác payload
- [ ] CHECKOUT-08: rollback giữa các bước DB
- [ ] CHECKOUT-09: timeout sau commit
- [ ] CHECKOUT-10: snapshot giá/SKU/địa chỉ
- [ ] CHECKOUT-11: chuyển trạng thái sai
- [ ] CHECKOUT-12: hủy đơn đúng policy
- [ ] CHECKOUT-13: COD
- [ ] CHECKOUT-14: đơn người khác
- [ ] CHECKOUT-15: outbox event không mất

## Thanh toán và hoàn tiền (P0)

- [ ] PAYMENT-01: Chữ ký webhook sai
- [ ] PAYMENT-02: amount/currency/order mismatch
- [ ] PAYMENT-03: callback browser giả
- [ ] PAYMENT-04: webhook trùng
- [ ] PAYMENT-05: event đến sai thứ tự
- [ ] PAYMENT-06: timeout provider
- [ ] PAYMENT-07: retry không double charge
- [ ] PAYMENT-08: payment success sau expiry
- [ ] PAYMENT-09: thất bại không đánh dấu paid
- [ ] PAYMENT-10: partial refund
- [ ] PAYMENT-11: refund vượt số đã thu
- [ ] PAYMENT-12: refund trùng
- [ ] PAYMENT-13: reconciliation lệch
- [ ] PAYMENT-14: log không chứa secret/card data

## Vận chuyển (P1)

- [ ] SHIPPING-01: Địa chỉ không phục vụ
- [ ] SHIPPING-02: phí theo trọng lượng
- [ ] SHIPPING-03: quote hết hạn
- [ ] SHIPPING-04: provider timeout
- [ ] SHIPPING-05: tạo shipment trùng
- [ ] SHIPPING-06: tracking webhook sai chữ ký nếu hỗ trợ
- [ ] SHIPPING-07: trạng thái đến sai thứ tự
- [ ] SHIPPING-08: giao thất bại
- [ ] SHIPPING-09: COD đối soát
- [ ] SHIPPING-10: hủy shipment
- [ ] SHIPPING-11: retry
- [ ] SHIPPING-12: phí thực tế lệch quote

## Đổi trả và hậu mãi (P0)

- [ ] RETURNS-01: Ngoài thời hạn
- [ ] RETURNS-02: số lượng trả vượt mua
- [ ] RETURNS-03: trả một phần
- [ ] RETURNS-04: item không đủ điều kiện
- [ ] RETURNS-05: yêu cầu trùng
- [ ] RETURNS-06: refund theo snapshot và discount allocation
- [ ] RETURNS-07: restock đúng tình trạng
- [ ] RETURNS-08: quyền duyệt
- [ ] RETURNS-09: audit
- [ ] RETURNS-10: lỗi refund sau khi nhận hàng
- [ ] RETURNS-11: trạng thái return/refund độc lập

## CMS và back-office (P1)

- [ ] CMS-01: Role matrix từng action
- [ ] CMS-02: staff không sửa quyền trái phép
- [ ] CMS-03: bulk action partial failure
- [ ] CMS-04: import CSV lỗi dòng
- [ ] CMS-05: export không lộ PII
- [ ] CMS-06: publish/unpublish
- [ ] CMS-07: concurrent edit
- [ ] CMS-08: audit actor/before/after
- [ ] CMS-09: search/filter/pagination
- [ ] CMS-10: destructive confirmation
- [ ] CMS-11: upload validation
- [ ] CMS-12: session expiry

## Tìm kiếm, review và notification (P1)

- [ ] SEARCH-01: Search tiếng Việt có dấu
- [ ] SEARCH-02: filter kết hợp
- [ ] SEARCH-03: sort ổn định
- [ ] SEARCH-04: pagination không trùng
- [ ] SEARCH-05: index cập nhật sau publish
- [ ] SEARCH-06: review chỉ người đủ điều kiện theo policy
- [ ] SEARCH-07: moderation
- [ ] SEARCH-08: XSS nội dung
- [ ] SEARCH-09: email gửi trùng
- [ ] SEARCH-10: queue retry
- [ ] SEARCH-11: unsubscribe marketing
- [ ] SEARCH-12: template locale
- [ ] SEARCH-13: không lộ dữ liệu trong email
