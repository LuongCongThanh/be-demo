# 01. Tầm nhìn và phạm vi

> Trạng thái: **Đã chốt cho MVP** ([quy ước](../README.md#trạng-thái-tài-liệu)).
> Thuật ngữ dùng theo [GLOSSARY.md](../../GLOSSARY.md).

## 1. Bối cảnh

Doanh nghiệp bán lẻ thời trang muốn có kênh bán hàng online của riêng mình, không phụ thuộc vào sàn TMĐT, để:

- Chủ động về giá, khuyến mãi và dữ liệu khách hàng.
- Xây dựng thương hiệu và tập khách hàng quay lại.
- Giảm phí hoa hồng phải trả cho sàn.

Hệ thống phục vụ thị trường **Việt Nam**: thanh toán bằng VND qua VNPay, MoMo hoặc COD, và giao hàng qua GHN.

## 2. Tầm nhìn

Backend được thiết kế riêng cho Fashion Store theo phạm vi trong tài liệu này. Repo không đặt mục tiêu trở thành boilerplate ecommerce tổng quát; các quyết định kiến trúc ưu tiên nghiệp vụ của cửa hàng.

> Một cửa hàng thời trang online nơi Người mua tìm được đúng size, đúng màu và đặt hàng trong vài phút, có hoặc không có tài khoản. Phía doanh nghiệp xử lý đơn nhanh, không bán vượt tồn kho.

## 3. Mục tiêu kinh doanh

| #   | Mục tiêu                       | Chỉ số đo (KPI)                                             | Mục tiêu MVP **[Giả định · kiểm chứng: số liệu 3 tháng đầu production]** |
| --- | ------------------------------ | ----------------------------------------------------------- | ------------------------------------------------------------------------ |
| G1  | Khách đặt hàng dễ dàng         | Tỉ lệ chuyển đổi (đơn / phiên truy cập)                     | ≥ 1,5%                                                                   |
| G2  | Không bán vượt tồn kho         | Số đơn bị huỷ do hết hàng thật                              | < 0,5% số đơn                                                            |
| G3  | Xử lý đơn nhanh                | Thời gian từ Chờ xác nhận đến Đang giao                     | Trung bình ≤ 24 giờ                                                      |
| G4  | Thanh toán online đáng tin cậy | Tỉ lệ đơn online bị lệch trạng thái thanh toán sau đối soát | 0 đơn lệch quá 15 phút                                                   |
| G5  | Giữ chân khách                 | Tỉ lệ Khách hàng mua lần 2 trong 90 ngày                    | ≥ 20%                                                                    |

## 4. Đối tượng sử dụng

Chi tiết xem [02-actors-permissions.md](./02-actors-permissions.md).

- **Khách vãng lai (Guest)**: mua hàng không cần tài khoản.
- **Khách hàng (Customer)**: có tài khoản, xem lịch sử đơn, lưu sổ địa chỉ.
- **Nhân viên vận hành (Staff)**: xử lý đơn, cập nhật tồn kho, xử lý Đổi trả.
- **Quản trị viên (Admin)**: quản lý Sản phẩm, giá, khuyến mãi, nhân viên và cấu hình.

## 5. Phạm vi

### 5.1. MVP

| Nhóm              | Tính năng                                                                                                                                             |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Danh mục hàng hoá | Danh mục nhiều cấp, Sản phẩm với Biến thể size×màu, ảnh theo màu, Giá khuyến mãi                                                                      |
| Tìm kiếm và duyệt | Tìm theo tên (gõ có dấu hoặc không dấu), lọc theo danh mục, size, màu, khoảng giá; sắp xếp theo mới nhất, giá, bán chạy                               |
| Giỏ hàng          | Giỏ lưu ở server cho cả Khách vãng lai và Khách hàng, gộp giỏ khi đăng nhập                                                                           |
| Checkout          | Đặt hàng có hoặc không có tài khoản, nhập địa chỉ theo 2 cấp tỉnh/thành và phường/xã, tính phí ship qua GHN, áp 1 Voucher                             |
| Thanh toán        | VNPay, MoMo, COD                                                                                                                                      |
| Vận chuyển        | Tạo vận đơn GHN tự động, cập nhật trạng thái giao hàng                                                                                                |
| Đơn hàng          | Theo dõi trạng thái, Khách tự huỷ (theo quy tắc), Khách vãng lai tra cứu bằng mã đơn và số điện thoại                                                 |
| Tài khoản         | Đăng ký và đăng nhập bằng email + mật khẩu hoặc Google, quên mật khẩu, sổ địa chỉ, lịch sử đơn, chọn ngôn ngữ vi/en                                   |
| Khuyến mãi        | Voucher cơ bản (theo % hoặc số tiền cố định)                                                                                                          |
| Thông báo         | Email xác nhận đơn và cập nhật trạng thái                                                                                                             |
| Back-office       | Quản lý Sản phẩm, danh sách size và bảng màu, Tồn kho (gồm Kiểm kê), Đơn hàng, Voucher, Giá khuyến mãi, Staff; ghi nhận Đổi trả và Hoàn tiền thủ công |
| Pháp lý           | Xin đồng ý xử lý dữ liệu cá nhân, yêu cầu xoá hoặc ẩn danh dữ liệu                                                                                    |

### 5.2. Giai đoạn 2

- Đánh giá Sản phẩm, wishlist.
- Flash sale, điểm thành viên.
- Đổi trả online (Người mua tự tạo yêu cầu), Hoàn tiền tự động qua API cổng thanh toán.
- Hoá đơn điện tử tích hợp tự động.
- Thông báo qua SMS và Zalo ZNS, đăng nhập bằng OTP số điện thoại.
- Nhiều Kho.
- Tìm kiếm nâng cao (bỏ qua lỗi chính tả, facet) bằng Meilisearch.

### 5.3. Ngoài phạm vi

- Marketplace nhiều người bán.
- Bán sỉ B2B, giá theo hợp đồng.
- Bán ra nước ngoài, đa tiền tệ.
- Nội dung Sản phẩm đa ngôn ngữ: **nội dung chỉ có tiếng Việt**, còn giao diện có vi/en.
- Ứng dụng mobile native (Backend vẫn sẵn sàng cho mobile app sau này).

## 6. Giả định và ràng buộc

| Loại      | Nội dung                                                                                                                    |
| --------- | --------------------------------------------------------------------------------------------------------------------------- |
| Ràng buộc | Một doanh nghiệp bán, một Kho ở MVP                                                                                         |
| Ràng buộc | Tiền tệ duy nhất là VND, không có số lẻ                                                                                     |
| Ràng buộc | Giai đoạn đầu chỉ làm Backend; Frontend (storefront và back-office Next.js) làm sau                                         |
| Ràng buộc | Phát triển và chạy thử ở local trước, AWS là môi trường mục tiêu sau khi chạy thành công                                    |
| Giả định  | Quy mô MVP khoảng 500–5.000 đơn/ngày **[Giả định · kiểm chứng: test tải k6 trên staging, [10](../architecture/10-nfr.md)]** |
| Giả định  | Đổi trả và Hoàn tiền ở MVP được Staff xử lý thủ công qua hotline hoặc Zalo                                                  |
| Giả định  | Hoá đơn điện tử ở MVP được kế toán xuất thủ công bằng phần mềm hoá đơn bên ngoài                                            |

## 7. Rủi ro chính

| Rủi ro                              | Ảnh hưởng                       | Hướng giảm thiểu                                                                                             |
| ----------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Bán vượt tồn kho khi có khuyến mãi  | Huỷ đơn, mất uy tín             | Giữ hàng có thời hạn, khoá dòng dữ liệu khi trừ Tồn kho (xem [04-business-rules.md](./04-business-rules.md)) |
| Mất hoặc lệch trạng thái thanh toán | Khách đã trả tiền mà đơn bị huỷ | IPN + job đối soát định kỳ, tự tạo Hoàn tiền khi nhận tiền cho đơn đã huỷ                                    |
| API GHN lỗi khi tính phí ship       | Khách không checkout được       | Dùng phí ship dự phòng                                                                                       |
| Vi phạm quy định dữ liệu cá nhân    | Bị phạt                         | Xem [06-compliance.md](./06-compliance.md)                                                                   |
