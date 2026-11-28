# Kế hoạch và nhiệm vụ

Nơi theo dõi công việc của dự án (thay cho GitHub Issues).

## Cấu trúc

```
docs/plan/
├── README.md                     ← file này: bảng tổng hợp nhiệm vụ
├── initiatives/<effort>/         ← map quyết định (map.md + issues/), không phải hàng đợi triển khai; kết quả chốt đi vào docs/adr/ và sinh ra nhiệm vụ trong tasks/
│                                   ví dụ realign-identity-catalog/ (map.md + metric.md, đã hoàn thành cho 01–05)
└── tasks/
    ├── todo/                     ← nhiệm vụ chưa hoàn tất (status todo hoặc in-progress)
    ├── done/                     ← nhiệm vụ đã hợp nhất (status done)
    └── wontfix/                  ← nhiệm vụ đã quyết định không làm, kèm lý do trong spec.md
        └── <NN>-<kebab-name>/
            ├── spec.md    ← trước khi viết mã: mục tiêu, phạm vi, tiêu chí nghiệm thu; metadata status/pr/blocked-by
            ├── plan.md    ← trước khi viết mã: các bước, nhánh, rủi ro
            ├── guide.md   ← trước khi viết mã: hướng dẫn triển khai (vị trí sửa, gợi ý, kiểm thử, lưu ý) — không phải mã hoàn chỉnh
            ├── metric.md  ← số liệu trước → sau
            └── report.md  ← sau khi hợp nhất: kết quả, điểm khác với đặc tả, bài học
```

| Thư mục                           | Số nhiệm vụ | Ý nghĩa                                    |
| --------------------------------- | ----------- | ------------------------------------------ |
| [tasks/todo/](./tasks/todo)       | 18          | Chưa hoàn tất: 18 `todo`, 0 `in-progress`. |
| [tasks/done/](./tasks/done)       | 33          | Đã hợp nhất.                               |
| [tasks/wontfix/](./tasks/wontfix) | 0           | Chưa có nhiệm vụ bị bỏ.                    |

Quy ước:

- `NN` là thứ tự thực hiện. Tên thư mục dùng tiếng Anh theo kiểu kebab-case.
- Trường `status` trong metadata đầu `spec.md` nhận một trong các giá trị `todo` | `in-progress` | `done`. Cập nhật bảng cùng lúc.
- Chỉ viết đầy đủ nội dung nhiệm vụ khi bắt đầu (sau khi nhiệm vụ trước đã được hợp nhất); trước đó chỉ cần khung `spec.md`. Ngoại lệ: các nhiệm vụ được tạo từ cùng một buổi phân tích/đánh giá kiến trúc (ví dụ 07–08) có thể được viết đầy đủ cùng lúc để lưu lại các quyết định; khi bắt đầu từng nhiệm vụ phải đối chiếu lại với mã hiện tại.
- Khi phát sinh việc mới: tạo thư mục nhiệm vụ trong `tasks/todo/` với `spec.md` khung và thêm một dòng vào bảng **Chưa hoàn tất**.
- Thư mục nhóm theo tình trạng chỉ để điều hướng; `status` trong `spec.md` vẫn là nguồn chuẩn. Task `todo` và `in-progress` đều nằm trong `tasks/todo/`.
- Khi task hợp nhất: đặt `status: done`, ghi `pr`, viết `report.md`, rồi `git mv` cả thư mục sang `tasks/done/`, chuyển dòng sang bảng **Đã hoàn tất** và sửa các link trỏ tới task đó. Task cha (như 25) chỉ chuyển khi mọi task con đã `done` và tiêu chí của nó đạt.
- Khi quyết định không làm: ghi quyết định và lý do trong `spec.md`, rồi chuyển cả thư mục sang `tasks/wontfix/`. Chưa rõ hoặc đang bị chặn thì vẫn ở `tasks/todo/`.
- `blocked-by` ghi tên thư mục task (ví dụ `46-migrate-checkout`), không kèm `todo/`, `done/` hay `wontfix/`; khi tra phụ thuộc, tìm trong cả ba nhóm.
- Không lặp lại trạng thái trong phần thân `spec.md` (ví dụ dòng `**Status:**`); chỉ dùng frontmatter.
- `metric.md` ghi số token **đo thực tế** (không ước lượng), chia theo mã nguồn / kiểm thử / tài liệu / khảo sát: `npm run tokens -- <sessionId|latest> [--since <ISO>] [--until <ISO>] --md` (`scripts/token-usage.ts` đọc bản ghi phiên Claude Code tại `~/.claude/projects/`; chỉ phân loại được tệp sửa bằng Write/Edit — sửa bằng Bash được tính vào `explore/chat`).

## Danh sách nhiệm vụ

Kế hoạch tổng thể: [realign-identity-catalog.md](initiatives/realign-identity-catalog/map.md)

### Chưa hoàn tất (`tasks/todo/`)

| #   | Nhiệm vụ                                                                                                                                     | Trạng thái | Phụ thuộc                                                                                |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------- |
| 11  | [Triển khai backend miễn phí (Render + Neon)](./tasks/todo/11-deploy-render-free/spec.md)                                                    | todo       | —                                                                                        |
| 25  | [MVP thương mại end-to-end](./tasks/todo/25-mvp-commerce-end-to-end/spec.md) (nhiệm vụ cha)                                                  | todo       | 17-access-admin-api, 24-category-content                                                 |
| 29  | [Thanh toán online và đối soát](./tasks/todo/29-online-payment/spec.md)                                                                      | todo       | 28-cod-checkout, 46-migrate-checkout                                                     |
| 30  | [Tra cứu và xem đơn Buyer](./tasks/todo/30-buyer-order-access/spec.md)                                                                       | todo       | 28-cod-checkout                                                                          |
| 31  | [Huỷ đơn Buyer và hoàn nghĩa vụ](./tasks/todo/31-buyer-cancellation/spec.md)                                                                 | todo       | 28-cod-checkout, 29-online-payment                                                       |
| 32  | [Vận đơn GHN và đối soát giao hàng](./tasks/todo/32-ghn-fulfillment/spec.md)                                                                 | todo       | 28-cod-checkout, 29-online-payment                                                       |
| 33  | [Nghiệp vụ Staff xử lý đơn](./tasks/todo/33-staff-order-operations/spec.md)                                                                  | todo       | 27-inventory-availability, 41-migrate-inventory, 32-ghn-fulfillment, 17-access-admin-api |
| 34  | [Hoàn hàng, Đổi trả và Hoàn tiền](./tasks/todo/34-returns-refunds/spec.md)                                                                   | todo       | 29-online-payment, 33-staff-order-operations                                             |
| 35  | [Thông báo Email theo vòng đời đơn](./tasks/todo/35-order-notifications/spec.md)                                                             | todo       | 28-cod-checkout, 29-online-payment, 32-ghn-fulfillment, 34-returns-refunds               |
| 36  | [Đồng ý dữ liệu, vận hành và báo cáo](./tasks/todo/36-compliance-operations-reporting/spec.md)                                               | todo       | 17-access-admin-api, 28-cod-checkout, 33-staff-order-operations, 34-returns-refunds      |
| 43  | [Chuyển feature catalog/category sang kiến trúc chung](./tasks/todo/43-migrate-catalog-category/spec.md)                                     | todo       | 40-lint-boundary-generator                                                               |
| 44  | [Chuyển catalog/product, product-option, pricing và tạo CatalogService](./tasks/todo/44-migrate-catalog-product-option-pricing/spec.md)      | todo       | 41-migrate-inventory, 43-migrate-catalog-category                                        |
| 45  | [Chuyển module cart sang kiến trúc chung](./tasks/todo/45-migrate-cart/spec.md)                                                              | todo       | 41-migrate-inventory, 44-migrate-catalog-product-option-pricing                          |
| 46  | [Chuyển module checkout sang kiến trúc chung](./tasks/todo/46-migrate-checkout/spec.md)                                                      | todo       | 41-migrate-inventory, 42-migrate-voucher, 44-migrate-catalog-product-option-pricing      |
| 47  | [Chuyển identity/access và identity/internal-account sang kiến trúc chung](./tasks/todo/47-migrate-identity-access-internal-account/spec.md) | todo       | 40-lint-boundary-generator                                                               |
| 48  | [Chuyển identity/auth sang kiến trúc chung](./tasks/todo/48-migrate-identity-auth/spec.md)                                                   | todo       | 47-migrate-identity-access-internal-account                                              |
| 49  | [Hoàn tất chuyển đổi kiến trúc](./tasks/todo/49-finalize-architecture-migration/spec.md)                                                     | todo       | 45-migrate-cart, 46-migrate-checkout, 48-migrate-identity-auth                           |
| 51  | [Ghi movement khi trừ kho cho đơn hàng](./tasks/todo/51-order-stock-movements/spec.md)                                                       | todo       | 46-migrate-checkout                                                                      |

### Đã hoàn tất (`tasks/done/`)

| #   | Nhiệm vụ                                                                                                    | PR        |
| --- | ----------------------------------------------------------------------------------------------------------- | --------- |
| 01  | [Mô hình bốn vai trò](./tasks/done/01-rename-roles/spec.md)                                                 | #60       |
| 02  | [Đăng nhập trả vai trò, quản lý nhân viên, lệnh tạo quản trị](./tasks/done/02-login-role-staff-cli/spec.md) | #60       |
| 03  | [Trạng thái sản phẩm và lưu trữ](./tasks/done/03-product-status-archive/spec.md)                            | #60       |
| 04  | [Kích cỡ, màu sắc và quy tắc biến thể](./tasks/done/04-sizes-colors-variants/spec.md)                       | #60       |
| 05  | [Danh mục nhiều cấp](./tasks/done/05-nested-categories/spec.md)                                             | #60       |
| 06  | [Gộp chức năng danh mục và sản phẩm thành một mô-đun](./tasks/done/06-catalog-module/spec.md)               | #63       |
| 07  | [Gộp `auth` và `staff` vào mô-đun định danh](./tasks/done/07-identity-module/spec.md)                       | #65       |
| 08  | [Tách `AuthService` theo từng nghiệp vụ](./tasks/done/08-identity-use-case-services/spec.md)                | #76       |
| 09  | [Cổng phân quyền `@Authorize` ở `common/auth/`](./tasks/done/09-authorize-decorator/spec.md)                | #67       |
| 10  | [Gom hạ tầng vào `infrastructure/`](./tasks/done/10-infrastructure-folder/spec.md)                          | #68       |
| 12  | [`identity/` theo cấu trúc phẳng](./tasks/done/12-identity-subfolders/spec.md)                              | #77       |
| 13  | [`catalog/` theo cấu trúc phẳng](./tasks/done/13-catalog-subfolders/spec.md)                                | #75       |
| 14  | [Phát hành hợp đồng OpenAPI theo phiên bản](./tasks/done/14-openapi-contract/spec.md)                       | #80       |
| 15  | [Lược đồ RBAC và chuyển đổi dữ liệu `ADMIN`/`STAFF`](./tasks/done/15-rbac-schema/spec.md)                   | #81       |
| 16  | [`PermissionsGuard` và `auth/me`](./tasks/done/16-permissions-guard/spec.md)                                | #82       |
| 17  | [API quản lý vai trò và quyền](./tasks/done/17-access-admin-api/spec.md)                                    | #83, #115 |
| 18  | [Chi tiết tài khoản nội bộ kèm vai trò](./tasks/done/18-staff-detail-roles/spec.md)                         | #85       |
| 19  | [Tìm kiếm, sắp xếp, lọc giá Sản phẩm](./tasks/done/19-catalog-search-sort/spec.md)                          | #86       |
| 20  | [Tải ảnh sản phẩm lên Cloudinary](./tasks/done/20-product-image-upload/spec.md)                             | #87       |
| 21  | [Slug sản phẩm, giới tính và lọc danh mục con](./tasks/done/21-product-slug-gender/spec.md)                 | #90       |
| 22  | [Giá khuyến mãi](./tasks/done/22-sale-prices/spec.md)                                                       | #91       |
| 23  | [Quản lý voucher](./tasks/done/23-vouchers/spec.md)                                                         | #92       |
| 24  | [Hoàn thiện hợp đồng danh mục cho CMS và cửa hàng](./tasks/done/24-category-content/spec.md)                | #98, #116 |
| 26  | [Giỏ hàng Buyer và gộp giỏ](./tasks/done/26-buyer-cart/spec.md)                                             | #118      |
| 27  | [Tồn kho và điều chỉnh Staff](./tasks/done/27-inventory-availability/spec.md)                               | #119      |
| 28  | [Tính thử và đặt đơn COD](./tasks/done/28-cod-checkout/spec.md)                                             | #120      |
| 37  | [Định danh và hồ sơ Khách hàng](./tasks/done/37-customer-identity-profile/spec.md)                          | #117      |
| 38  | [Viết tài liệu chuẩn kiến trúc module](./tasks/done/38-architecture-standard-docs/spec.md)                  | #141      |
| 39  | [Nền móng dùng chung cho kiến trúc mới](./tasks/done/39-shared-architecture-foundations/spec.md)            | #142      |
| 40  | [Script sinh luật lint ranh giới](./tasks/done/40-lint-boundary-generator/spec.md)                          | #143      |
| 41  | [Chuyển module inventory sang kiến trúc chung](./tasks/done/41-migrate-inventory/spec.md)                   | #144      |
| 42  | [Chuyển module voucher sang kiến trúc chung](./tasks/done/42-migrate-voucher/spec.md)                       | #146      |
| 50  | [Sửa race khi xác nhận phiếu kiểm kê](./tasks/done/50-fix-stock-count-confirm-race/spec.md)                 | #145      |

Ghi chú:

- Nhiệm vụ 17 hoàn tất qua hai PR: #83 hợp nhất phần API RBAC, #115 hợp nhất closure tài liệu và guard CLI ngăn tạo Admin thứ hai active.
- Nhiệm vụ 24 hoàn tất phần BE: ticket 01–03 về locale, backfill và biên tập bản dịch (PR #98, closure tài liệu #116). Danh sách ticket nằm trong [issues của nhiệm vụ](./tasks/done/24-category-content/issues/README.md). Phần cập nhật CMS/cửa hàng và triển khai chuyển đổi dữ liệu/bản dịch cần kế hoạch riêng, chưa tính vào nhiệm vụ này.
- Nhiệm vụ 25 là nhiệm vụ cha/điều phối của 26–37, không có PR triển khai riêng. Chỉ chuyển sang `tasks/done/` khi 26–37 đã `done` và kiểm thử end-to-end tổng thể trong spec đã đạt.
- Nhiệm vụ 28 là một vertical slice độc lập: quote nhận danh sách dòng trực tiếp; tích hợp Cart (26), GHN (32) và cấu hình vận hành là phần mở rộng.

## Thứ tự tiếp tục công việc

Cập nhật ngày 2026-11-28, theo `blocked-by` của từng nhiệm vụ và [ADR 0015](../adr/0015-one-layered-architecture-for-every-module.md): chuyển kiến trúc module trước, rồi mới làm tính năng đụng tới module đó.

1. **Chuyển đổi kiến trúc (38–49)** theo map [Chuẩn kiến trúc thống nhất cho toàn `src/modules`](initiatives/src-wide-architecture-standard/map.md). Đã xong 38–42. Còn lại:
   - 43 và 47 làm song song (chỉ cần 40).
   - 44 sau 43; 48 sau 47.
   - 45 và 46 sau 44 (cùng 41, 42 đã xong).
   - 49 sau 45, 46 và 48.
2. **Sửa theo review:** 51 (movement khi trừ kho cho đơn) làm ngay sau 46. 50 đã xong.
3. **Tính năng đơn hàng**, đều đụng module `checkout` nên làm sau 46:
   - 29 (thanh toán online), rồi 30 (tra cứu đơn). 30 chỉ bị chặn bởi 28 nhưng xếp sau 46 để không sửa `checkout` hai lần.
   - 31 và 32 sau 29.
   - 33 sau 32; rồi 34, 35, 36 theo `blocked-by`.
4. **25** đóng sau cùng, khi 26–37 đã `done` và kiểm thử end-to-end tổng thể đạt.
5. **11 (triển khai Render + Neon) vẫn hoãn:** trước khi bắt đầu cần chọn nhánh triển khai, cách chạy chuyển đổi cơ sở dữ liệu và cấu hình môi trường, đồng thời chuẩn bị thông tin truy cập Render/Neon.

### Mức độ xác nhận

Nhiệm vụ 01–05, 09–10 đã có PR hợp nhất nhưng thiếu báo cáo nghiệm thu theo từng nhiệm vụ (báo cáo 01 còn khung trống; một số nhiệm vụ chưa có `report.md`). Vì vậy `done` ở các mục này dựa trên việc đã hợp nhất và bằng chứng kiểm thử tổng hợp, không phải báo cáo đầy đủ từng tiêu chí.

### Phần giao nhau và đánh số

- Trước đây thư mục `21-category-content` dùng trùng số với nhiệm vụ `21-product-slug-gender` đã hoàn thành. Nhiệm vụ danh mục đã được chuyển thành nhiệm vụ 24; các liên kết và danh sách đã cập nhật.
- Nhiệm vụ 21 đã bổ sung chức năng lọc sản phẩm theo danh mục con. Nhiệm vụ 24 mở rộng quy tắc cho nhánh bị ẩn và xử lý nhất quán giữa danh mục với sản phẩm; đây là phần phát triển thêm, không phải triển khai lại hành vi cũ.
- Nhiệm vụ 24 dùng lại chức năng tải ảnh Cloudinary từ nhiệm vụ 20. Nhiệm vụ 22 (giá khuyến mãi) và nhiệm vụ 23 (voucher) giải quyết các nghiệp vụ khác nhau, không trùng lặp.
