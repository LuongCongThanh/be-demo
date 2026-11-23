# Kế hoạch và nhiệm vụ

Nơi theo dõi công việc của dự án (thay cho GitHub Issues).

## Cấu trúc

```
docs/plan/
├── README.md                     ← file này: bảng tổng hợp nhiệm vụ
├── <plan-tổng>.md                ← kế hoạch cho nhiều nhiệm vụ, ví dụ realign-identity-catalog.md
└── tasks/<NN>-<kebab-name>/
    ├── spec.md    ← trước khi viết mã: mục tiêu, phạm vi, tiêu chí nghiệm thu; metadata status/pr/blocked-by
    ├── plan.md    ← trước khi viết mã: các bước, nhánh, rủi ro
    ├── guide.md   ← trước khi viết mã: hướng dẫn triển khai (vị trí sửa, gợi ý, kiểm thử, lưu ý) — không phải mã hoàn chỉnh
    ├── metric.md  ← số liệu trước → sau
    └── report.md  ← sau khi hợp nhất: kết quả, điểm khác với đặc tả, bài học
```

Quy ước:

- `NN` là thứ tự thực hiện. Tên thư mục dùng tiếng Anh theo kiểu kebab-case.
- Trường `status` trong metadata đầu `spec.md` nhận một trong các giá trị `todo` | `in-progress` | `done`. Cập nhật bảng cùng lúc.
- Chỉ viết đầy đủ nội dung nhiệm vụ khi bắt đầu (sau khi nhiệm vụ trước đã được hợp nhất); trước đó chỉ cần khung `spec.md`. Ngoại lệ: các nhiệm vụ được tạo từ cùng một buổi phân tích/đánh giá kiến trúc (ví dụ 07–08) có thể được viết đầy đủ cùng lúc để lưu lại các quyết định; khi bắt đầu từng nhiệm vụ phải đối chiếu lại với mã hiện tại.
- Khi phát sinh việc mới: tạo thư mục nhiệm vụ với `spec.md` khung và thêm một dòng vào bảng.
- `metric.md` ghi số token **đo thực tế** (không ước lượng), chia theo mã nguồn / kiểm thử / tài liệu / khảo sát: `npm run tokens -- <sessionId|latest> [--since <ISO>] [--until <ISO>] --md` (`scripts/token-usage.ts` đọc bản ghi phiên Claude Code tại `~/.claude/projects/`; chỉ phân loại được tệp sửa bằng Write/Edit — sửa bằng Bash được tính vào `explore/chat`).

## Danh sách nhiệm vụ

Kế hoạch tổng thể: [realign-identity-catalog.md](./realign-identity-catalog.md)

| #   | Nhiệm vụ                                                                                                                                | Trạng thái | Phụ thuộc                                                                                | PR        |
| --- | --------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------- | --------- |
| 01  | [Mô hình bốn vai trò](./tasks/01-rename-roles/spec.md)                                                                                  | done       | —                                                                                        | #60       |
| 02  | [Đăng nhập trả vai trò, quản lý nhân viên, lệnh tạo quản trị](./tasks/02-login-role-staff-cli/spec.md)                                  | done       | 01-rename-roles                                                                          | #60       |
| 03  | [Trạng thái sản phẩm và lưu trữ](./tasks/03-product-status-archive/spec.md)                                                             | done       | 02-login-role-staff-cli                                                                  | #60       |
| 04  | [Kích cỡ, màu sắc và quy tắc biến thể](./tasks/04-sizes-colors-variants/spec.md)                                                        | done       | 03-product-status-archive                                                                | #60       |
| 05  | [Danh mục nhiều cấp](./tasks/05-nested-categories/spec.md)                                                                              | done       | 04-sizes-colors-variants                                                                 | #60       |
| 06  | [Gộp chức năng danh mục và sản phẩm thành một mô-đun](./tasks/06-catalog-module/spec.md)                                                | done       | —                                                                                        | #63       |
| 07  | [Gộp `auth` và `staff` vào mô-đun định danh](./tasks/07-identity-module/spec.md)                                                        | done       | 06                                                                                       | #65       |
| 08  | [Tách `AuthService` theo từng nghiệp vụ](./tasks/08-identity-use-case-services/spec.md)                                                 | done       | 07                                                                                       | #76       |
| 09  | [Cổng phân quyền `@Authorize` ở `common/auth/`](./tasks/09-authorize-decorator/spec.md)                                                 | done       | —                                                                                        | #67       |
| 10  | [Gom hạ tầng vào `infrastructure/`](./tasks/10-infrastructure-folder/spec.md)                                                           | done       | 09                                                                                       | #68       |
| 11  | [Triển khai backend miễn phí (Render + Neon)](./tasks/11-deploy-render-free/spec.md)                                                    | todo       | —                                                                                        |           |
| 12  | [`identity/` theo cấu trúc phẳng](./tasks/12-identity-subfolders/spec.md)                                                               | done       | 08                                                                                       | #77       |
| 13  | [`catalog/` theo cấu trúc phẳng](./tasks/13-catalog-subfolders/spec.md)                                                                 | done       | —                                                                                        | #75       |
| 14  | [Phát hành hợp đồng OpenAPI theo phiên bản](./tasks/14-openapi-contract/spec.md)                                                        | done       | —                                                                                        | #80       |
| 15  | [Lược đồ RBAC và chuyển đổi dữ liệu `ADMIN`/`STAFF`](./tasks/15-rbac-schema/spec.md)                                                    | done       | —                                                                                        | #81       |
| 16  | [`PermissionsGuard` và `auth/me`](./tasks/16-permissions-guard/spec.md)                                                                 | done       | 15                                                                                       | #82       |
| 17  | [API quản lý vai trò và quyền](./tasks/17-access-admin-api/spec.md)                                                                     | done       | 16                                                                                       | #83, #115 |
| 18  | [Chi tiết tài khoản nội bộ kèm vai trò](./tasks/18-staff-detail-roles/spec.md)                                                          | done       | 17                                                                                       | #85       |
| 19  | [Tìm kiếm, sắp xếp, lọc giá Sản phẩm](./tasks/19-catalog-search-sort/spec.md)                                                           | done       | —                                                                                        | #86       |
| 20  | [Tải ảnh sản phẩm lên Cloudinary](./tasks/20-product-image-upload/spec.md)                                                              | done       | 19                                                                                       | #87       |
| 21  | [Slug sản phẩm, giới tính và lọc danh mục con](./tasks/21-product-slug-gender/spec.md)                                                  | done       | —                                                                                        | #90       |
| 22  | [Giá khuyến mãi](./tasks/22-sale-prices/spec.md)                                                                                        | done       | 21-product-slug-gender                                                                   | #91       |
| 23  | [Quản lý voucher](./tasks/23-vouchers/spec.md)                                                                                          | done       | 22-sale-prices                                                                           | #92       |
| 24  | [Hoàn thiện hợp đồng danh mục cho CMS và cửa hàng](./tasks/24-category-content/spec.md)                                                 | done       | —                                                                                        | #98, #116 |
| 25  | [MVP thương mại end-to-end](./tasks/25-mvp-commerce-end-to-end/spec.md)                                                                 | todo       | 17-access-admin-api, 24-category-content                                                 |           |
| 26  | [Giỏ hàng Buyer và gộp giỏ](./tasks/26-buyer-cart/spec.md)                                                                              | done       | 17-access-admin-api, 24-category-content                                                 | #118      |
| 27  | [Tồn kho và điều chỉnh Staff](./tasks/27-inventory-availability/spec.md)                                                                | done       | 26-buyer-cart                                                                            | #119      |
| 28  | [Tính thử và đặt đơn COD](./tasks/28-cod-checkout/spec.md)                                                                              | done       | —                                                                                        | #120      |
| 29  | [Thanh toán online và đối soát](./tasks/29-online-payment/spec.md)                                                                      | todo       | 28-cod-checkout, 46-migrate-checkout                                                     |           |
| 30  | [Tra cứu và xem đơn Buyer](./tasks/30-buyer-order-access/spec.md)                                                                       | todo       | 28-cod-checkout                                                                          |           |
| 31  | [Huỷ đơn Buyer và hoàn nghĩa vụ](./tasks/31-buyer-cancellation/spec.md)                                                                 | todo       | 28-cod-checkout, 29-online-payment                                                       |           |
| 32  | [Vận đơn GHN và đối soát giao hàng](./tasks/32-ghn-fulfillment/spec.md)                                                                 | todo       | 28-cod-checkout, 29-online-payment                                                       |           |
| 33  | [Nghiệp vụ Staff xử lý đơn](./tasks/33-staff-order-operations/spec.md)                                                                  | todo       | 27-inventory-availability, 41-migrate-inventory, 32-ghn-fulfillment, 17-access-admin-api |           |
| 34  | [Hoàn hàng, Đổi trả và Hoàn tiền](./tasks/34-returns-refunds/spec.md)                                                                   | todo       | 29-online-payment, 33-staff-order-operations                                             |           |
| 35  | [Thông báo Email theo vòng đời đơn](./tasks/35-order-notifications/spec.md)                                                             | todo       | 28-cod-checkout, 29-online-payment, 32-ghn-fulfillment, 34-returns-refunds               |           |
| 36  | [Đồng ý dữ liệu, vận hành và báo cáo](./tasks/36-compliance-operations-reporting/spec.md)                                               | todo       | 17-access-admin-api, 28-cod-checkout, 33-staff-order-operations, 34-returns-refunds      |           |
| 37  | [Định danh và hồ sơ Khách hàng](./tasks/37-customer-identity-profile/spec.md)                                                           | done       | 08-identity-use-case-services, 16-permissions-guard                                      | #117      |
| 38  | [Viết tài liệu chuẩn kiến trúc module](./tasks/38-architecture-standard-docs/spec.md)                                                   | todo       | —                                                                                        |           |
| 39  | [Nền móng dùng chung cho kiến trúc mới](./tasks/39-shared-architecture-foundations/spec.md)                                             | todo       | 38-architecture-standard-docs                                                            |           |
| 40  | [Script sinh luật lint ranh giới](./tasks/40-lint-boundary-generator/spec.md)                                                           | todo       | 39-shared-architecture-foundations                                                       |           |
| 41  | [Chuyển module inventory sang kiến trúc chung](./tasks/41-migrate-inventory/spec.md)                                                    | todo       | 40-lint-boundary-generator                                                               |           |
| 42  | [Chuyển module voucher sang kiến trúc chung](./tasks/42-migrate-voucher/spec.md)                                                        | todo       | 40-lint-boundary-generator                                                               |           |
| 43  | [Chuyển feature catalog/category sang kiến trúc chung](./tasks/43-migrate-catalog-category/spec.md)                                     | todo       | 40-lint-boundary-generator                                                               |           |
| 44  | [Chuyển catalog/product, product-option, pricing và tạo CatalogService](./tasks/44-migrate-catalog-product-option-pricing/spec.md)      | todo       | 41-migrate-inventory, 43-migrate-catalog-category                                        |           |
| 45  | [Chuyển module cart sang kiến trúc chung](./tasks/45-migrate-cart/spec.md)                                                              | todo       | 41-migrate-inventory, 44-migrate-catalog-product-option-pricing                          |           |
| 46  | [Chuyển module checkout sang kiến trúc chung](./tasks/46-migrate-checkout/spec.md)                                                      | todo       | 41-migrate-inventory, 42-migrate-voucher, 44-migrate-catalog-product-option-pricing      |           |
| 47  | [Chuyển identity/access và identity/internal-account sang kiến trúc chung](./tasks/47-migrate-identity-access-internal-account/spec.md) | todo       | 40-lint-boundary-generator                                                               |           |
| 48  | [Chuyển identity/auth sang kiến trúc chung](./tasks/48-migrate-identity-auth/spec.md)                                                   | todo       | 47-migrate-identity-access-internal-account                                              |           |
| 49  | [Hoàn tất chuyển đổi kiến trúc](./tasks/49-finalize-architecture-migration/spec.md)                                                     | todo       | 45-migrate-cart, 46-migrate-checkout, 48-migrate-identity-auth                           |           |

Các đầu việc thuộc Giai đoạn B của [Hoàn thiện hợp đồng danh mục cho CMS và cửa hàng](./tasks/24-category-content/issues/README.md) nằm trong nhiệm vụ cha; trạng thái và các mối phụ thuộc được theo dõi tại danh sách đó.

Nhiệm vụ 17 đã hoàn tất closure: PR #83 đã hợp nhất phần API RBAC, PR #115 theo dõi closure tài liệu và guard CLI ngăn tạo Admin thứ hai active.

## Thứ tự tiếp tục công việc

**Chuyển đổi kiến trúc (task 38–49)** theo map [Chuẩn kiến trúc thống nhất cho toàn `src/modules`](./wayfinding/src-wide-architecture-standard/map.md) và [ADR 0015](../adr/0015-one-layered-architecture-for-every-module.md): làm trước các task tính năng đụng tới module đó (task 29 chờ 46, task 33 chờ 41). Thứ tự: 38 → 39 → 40 → (41, 42, 43, 47 song song) → 44 → (45, 46, 48) → 49.

Đối chiếu theo báo cáo nhiệm vụ và các PR hiện tại vào ngày 2026-11-22:

1. **Đã hoàn thành:** nhiệm vụ 01–10, 12–16, 18–24, 26–28 và 37. Các PR/closure được ghi riêng theo từng nhiệm vụ.
2. **Nhiệm vụ 17:** đã hoàn tất closure tạo Admin duy nhất; PR API #83 và PR tài liệu/closure #115.
3. **Nhiệm vụ 24:** ticket BE 01–03 về locale, backfill và biên tập bản dịch đã hoàn tất; PR #98 đã hợp nhất, PR tài liệu closure #116 đang mở.
4. **Nhiệm vụ 26:** Giỏ hàng Guest/Customer, effective price và gộp giỏ đã được triển khai trong PR #118.
5. **Nhiệm vụ 27:** tồn kho, movement và kiểm kê đã được triển khai trong PR #119.
6. **Nhiệm vụ 28:** quote COD, idempotency và đặt đơn atomic đã được triển khai trong PR #120.
7. **Nhiệm vụ 37:** profile/địa chỉ/locale/Google login đã được triển khai trong PR #117.
8. **Nhiệm vụ 11 vẫn `todo` và được hoãn:** trước khi bắt đầu cần chọn nhánh triển khai, cách chạy chuyển đổi cơ sở dữ liệu và cấu hình môi trường, đồng thời chuẩn bị thông tin truy cập Render/Neon.
9. Sau các đầu việc BE của nhiệm vụ 24, cần lập kế hoạch riêng để cập nhật CMS/cửa hàng và triển khai chuyển đổi cơ sở dữ liệu/bản dịch. Đây là phần tích hợp tiếp theo, chưa được tính là hoàn thành trong phạm vi BE hiện tại.
10. Task 28 đã triển khai như một vertical slice độc lập: quote nhận danh sách dòng trực tiếp; tích hợp Cart từ task 26, GHN và cấu hình vận hành tiếp tục là phần mở rộng.

### Mức độ xác nhận

Nhiệm vụ 01–05, 09–10 đã có PR hợp nhất nhưng thiếu báo cáo nghiệm thu theo từng nhiệm vụ (báo cáo 01 còn khung trống; một số nhiệm vụ chưa có `report.md`). Vì vậy `done` ở các mục này dựa trên việc đã hợp nhất và bằng chứng kiểm thử tổng hợp, không phải báo cáo đầy đủ từng tiêu chí.

### Phần giao nhau và đánh số

- Trước đây thư mục `21-category-content` dùng trùng số với nhiệm vụ `21-product-slug-gender` đã hoàn thành. Nhiệm vụ danh mục đã được chuyển thành nhiệm vụ 24; các liên kết và danh sách đã cập nhật.
- Nhiệm vụ 21 đã bổ sung chức năng lọc sản phẩm theo danh mục con. Nhiệm vụ 24 mở rộng quy tắc cho nhánh bị ẩn và xử lý nhất quán giữa danh mục với sản phẩm; đây là phần phát triển thêm, không phải triển khai lại hành vi cũ.
- Nhiệm vụ 24 dùng lại chức năng tải ảnh Cloudinary từ nhiệm vụ 20. Nhiệm vụ 22 (giá khuyến mãi) và nhiệm vụ 23 (voucher) giải quyết các nghiệp vụ khác nhau, không trùng lặp.
- Nhiệm vụ 24 vẫn `in-progress`: phần BE nền tảng và đầu việc 01 đã xong, nhưng đầu việc 02–03 và tích hợp CMS/cửa hàng vẫn còn phía trước.
