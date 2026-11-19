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

| #   | Nhiệm vụ                                                                                               | Trạng thái  | Phụ thuộc                 | PR  |
| --- | ------------------------------------------------------------------------------------------------------ | ----------- | ------------------------- | --- |
| 01  | [Mô hình bốn vai trò](./tasks/01-rename-roles/spec.md)                                                 | done        | —                         | #60 |
| 02  | [Đăng nhập trả vai trò, quản lý nhân viên, lệnh tạo quản trị](./tasks/02-login-role-staff-cli/spec.md) | done        | 01-rename-roles           | #60 |
| 03  | [Trạng thái sản phẩm và lưu trữ](./tasks/03-product-status-archive/spec.md)                            | done        | 02-login-role-staff-cli   | #60 |
| 04  | [Kích cỡ, màu sắc và quy tắc biến thể](./tasks/04-sizes-colors-variants/spec.md)                       | done        | 03-product-status-archive | #60 |
| 05  | [Danh mục nhiều cấp](./tasks/05-nested-categories/spec.md)                                             | done        | 04-sizes-colors-variants  | #60 |
| 06  | [Gộp chức năng danh mục và sản phẩm thành một mô-đun](./tasks/06-catalog-module/spec.md)               | done        | —                         | #63 |
| 07  | [Gộp `auth` và `staff` vào mô-đun định danh](./tasks/07-identity-module/spec.md)                       | done        | 06                        | #65 |
| 08  | [Tách `AuthService` theo từng nghiệp vụ](./tasks/08-identity-use-case-services/spec.md)                | done        | 07                        | #76 |
| 09  | [Cổng phân quyền `@Authorize` ở `common/auth/`](./tasks/09-authorize-decorator/spec.md)                | done        | —                         | #67 |
| 10  | [Gom hạ tầng vào `infrastructure/`](./tasks/10-infrastructure-folder/spec.md)                          | done        | 09                        | #68 |
| 11  | [Triển khai backend miễn phí (Render + Neon)](./tasks/11-deploy-render-free/spec.md)                   | todo        | —                         |     |
| 12  | [`identity/` theo cấu trúc phẳng](./tasks/12-identity-subfolders/spec.md)                              | done        | 08                        | #77 |
| 13  | [`catalog/` theo cấu trúc phẳng](./tasks/13-catalog-subfolders/spec.md)                                | done        | —                         | #75 |
| 14  | [Phát hành hợp đồng OpenAPI theo phiên bản](./tasks/14-openapi-contract/spec.md)                       | done        | —                         | #80 |
| 15  | [Lược đồ RBAC và chuyển đổi dữ liệu `ADMIN`/`STAFF`](./tasks/15-rbac-schema/spec.md)                   | done        | —                         | #81 |
| 16  | [`PermissionsGuard` và `auth/me`](./tasks/16-permissions-guard/spec.md)                                | done        | 15                        | #82 |
| 17  | [API quản lý vai trò và quyền](./tasks/17-access-admin-api/spec.md)                                    | in-progress | 16                        | #83 |
| 18  | [Chi tiết tài khoản nội bộ kèm vai trò](./tasks/18-staff-detail-roles/spec.md)                         | done        | 17                        | #85 |
| 19  | [Tìm kiếm, sắp xếp, lọc giá Sản phẩm](./tasks/19-catalog-search-sort/spec.md)                          | done        | —                         | #86 |
| 20  | [Tải ảnh sản phẩm lên Cloudinary](./tasks/20-product-image-upload/spec.md)                             | done        | 19                        | #87 |
| 21  | [Slug sản phẩm, giới tính và lọc danh mục con](./tasks/21-product-slug-gender/spec.md)                 | done        | —                         | #90 |
| 22  | [Giá khuyến mãi](./tasks/22-sale-prices/spec.md)                                                       | done        | 21-product-slug-gender    | #91 |
| 23  | [Quản lý voucher](./tasks/23-vouchers/spec.md)                                                         | done        | 22-sale-prices            | #92 |
| 24  | [Hoàn thiện hợp đồng danh mục cho CMS và cửa hàng](./tasks/24-category-content/spec.md)                | in-progress | —                         |     |

Các đầu việc thuộc Giai đoạn B của [Hoàn thiện hợp đồng danh mục cho CMS và cửa hàng](./tasks/24-category-content/issues/README.md) nằm trong nhiệm vụ cha; trạng thái và các mối phụ thuộc được theo dõi tại danh sách đó.

Nhiệm vụ 17 vẫn `in-progress` dù PR #83 đã hợp nhất: lệnh CLI `create-admin` hiện vẫn có thể tạo Admin thứ hai, trái với tiêu chí trong [spec](./tasks/17-access-admin-api/spec.md); chi tiết nằm trong [report](./tasks/17-access-admin-api/report.md).

## Thứ tự tiếp tục công việc

Đối chiếu theo báo cáo nhiệm vụ và các commit trong nhánh `dev` hiện tại vào ngày 2026-11-20:

1. **Đã hoàn thành:** nhiệm vụ 01–10, 12–16 và 18–23. Các PR đã hợp nhất; nhiệm vụ 21–23 trước đây chưa có trong bảng nhưng đã được triển khai.
2. **Việc cần làm trước:** hoàn tất nhiệm vụ 17 bằng cách ngăn CLI `create-admin` tạo Admin thứ hai đang hoạt động, rồi kiểm thử cả CLI lẫn API.
3. **Tiếp theo:** nhiệm vụ 24, đầu việc 02 (bật ngôn ngữ và bổ sung bản dịch). Đầu việc 01 đã hoàn thành nên đầu việc 02 không còn bị chặn. Sau đó thực hiện đầu việc 03, vốn phụ thuộc đầu việc 02.
4. **Nhiệm vụ 11 vẫn `todo` và được hoãn:** trước khi bắt đầu cần chọn nhánh triển khai, cách chạy chuyển đổi cơ sở dữ liệu và cấu hình môi trường, đồng thời chuẩn bị thông tin truy cập Render/Neon.
5. Sau các đầu việc BE của nhiệm vụ 24, cần lập kế hoạch riêng để cập nhật CMS/cửa hàng và triển khai chuyển đổi cơ sở dữ liệu/bản dịch. Đây là phần tích hợp tiếp theo, chưa được tính là hoàn thành trong phạm vi BE hiện tại.

### Mức độ xác nhận

Nhiệm vụ 01–05, 09–10 đã có PR hợp nhất nhưng thiếu báo cáo nghiệm thu theo từng nhiệm vụ (báo cáo 01 còn khung trống; một số nhiệm vụ chưa có `report.md`). Vì vậy `done` ở các mục này dựa trên việc đã hợp nhất và bằng chứng kiểm thử tổng hợp, không phải báo cáo đầy đủ từng tiêu chí.

### Phần giao nhau và đánh số

- Trước đây thư mục `21-category-content` dùng trùng số với nhiệm vụ `21-product-slug-gender` đã hoàn thành. Nhiệm vụ danh mục đã được chuyển thành nhiệm vụ 24; các liên kết và danh sách đã cập nhật.
- Nhiệm vụ 21 đã bổ sung chức năng lọc sản phẩm theo danh mục con. Nhiệm vụ 24 mở rộng quy tắc cho nhánh bị ẩn và xử lý nhất quán giữa danh mục với sản phẩm; đây là phần phát triển thêm, không phải triển khai lại hành vi cũ.
- Nhiệm vụ 24 dùng lại chức năng tải ảnh Cloudinary từ nhiệm vụ 20. Nhiệm vụ 22 (giá khuyến mãi) và nhiệm vụ 23 (voucher) giải quyết các nghiệp vụ khác nhau, không trùng lặp.
- Nhiệm vụ 24 vẫn `in-progress`: phần BE nền tảng và đầu việc 01 đã xong, nhưng đầu việc 02–03 và tích hợp CMS/cửa hàng vẫn còn phía trước.
