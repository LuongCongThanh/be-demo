# Thời trang online (B2C)

Cửa hàng thời trang bán lẻ trực tuyến trong nước. Người mua đặt Biến thể size × màu, thanh toán COD hoặc online, giao qua GHN; nhân sự nội bộ vận hành qua back-office. Thuật ngữ dưới đây là ngôn ngữ chuẩn cho `docs/business/`, `docs/architecture/`, `docs/adr/` và tên trong code.

## Định danh & phân quyền

**Người mua** (`Buyer`):
Người đặt đơn trên storefront, gồm cả Khách vãng lai và Khách hàng.
_Tránh_: user, khách (chung chung), client

**Khách vãng lai** (`Guest`):
Người mua không có Tài khoản, được nhận diện bằng Giỏ hàng gắn trình duyệt và bằng Mã đơn + số điện thoại khi tra cứu đơn.
_Tránh_: anonymous user, khách lẻ

**Khách hàng** (`Customer`):
Người mua có Tài khoản đã đăng ký.
_Tránh_: member, thành viên

**Staff** (`Staff`):
Nhân viên nội bộ xử lý đơn, tồn kho, Đổi trả và Hoàn tiền hằng ngày trên back-office.
_Tránh_: ORDER_STAFF, STORE_MANAGER, nhân viên kho, operator

**Admin** (`Admin`):
Người nội bộ quản lý cấu hình, danh mục hàng hoá, Voucher và Tài khoản Staff; có mọi quyền của Staff.
_Tránh_: MASTER_ADMIN, superadmin, quản lý

_Ghi chú_: Khách hàng, Staff, Admin là ba loại Tài khoản. Staff và Admin đồng thời là hai Vai trò hệ thống; Khách hàng không phải Vai trò. Các mục "Tránh" ở trên nhắm vào tên vai trò cũ (`ORDER_STAFF`, `STORE_MANAGER`, `MASTER_ADMIN`).

**Tài khoản** (`Account`):
Danh tính đăng nhập gắn với đúng một email, thuộc một trong ba loại: Khách hàng, Staff hoặc Admin.
_Tránh_: user (khi nói về nghiệp vụ), profile

**Tài khoản nội bộ** (`InternalAccount`):
Tài khoản Staff hoặc Admin; không dùng để mua hàng.
_Tránh_: tài khoản quản trị, back-office user

**Quyền** (`Permission`):
Một hành động cụ thể trên back-office mà hệ thống cho phép hoặc từ chối; danh sách Quyền cố định, chỉ thay đổi khi phát hành phiên bản mới.
_Tránh_: scope, privilege, quyền hạn (chung chung)

**Vai trò** (`Role`):
Tập Quyền có tên, do Admin cấu hình và gán cho Tài khoản nội bộ; một Tài khoản nội bộ có thể có nhiều Vai trò. `Admin` và `Staff` là hai Vai trò hệ thống không xoá được.
_Tránh_: role (khi nói về loại Tài khoản), nhóm quyền, user group

## Danh mục hàng hoá

**Danh mục** (`Category`):
Nhóm phân loại Sản phẩm, xếp thành cây nhiều cấp.
_Tránh_: collection, nhóm hàng

**Sản phẩm** (`Product`):
Một mẫu hàng có tên, mô tả, cân nặng và ảnh theo màu; không được mua trực tiếp.
_Tránh_: item, mặt hàng, SKU

**Giới tính** (`Gender`):
Đối tượng mặc của Sản phẩm: Nam, Nữ, Trẻ em hoặc Unisex. Là thuộc tính để lọc, không phải Danh mục.
_Tránh_: đối tượng, giới (khi nói về Danh mục)

**Biến thể** (`Variant`):
Tổ hợp duy nhất size × màu của một Sản phẩm; là thứ Người mua thực sự mua và có giá, tồn kho riêng.
_Tránh_: product variant (dài), option, mẫu

**SKU** (`Sku`):
Mã định danh duy nhất toàn hệ thống của một Biến thể, không đổi sau khi đã có đơn.
_Tránh_: mã sản phẩm, product code

**Danh sách size** (`Size`):
Bộ size dùng chung do Admin quản lý, có thứ tự hiển thị; `FREESIZE` cho Sản phẩm không có size.
_Tránh_: kích cỡ tự do

**Bảng màu** (`Color`):
Bộ màu dùng chung do Admin quản lý, mỗi màu có mã, tên và mã hex.
_Tránh_: màu tự nhập

**Đang bán / Nháp / Ngừng bán** (`active` / `draft` / `archived`):
Trạng thái hiển thị của Sản phẩm; chỉ Đang bán hiển thị trên storefront.
_Tránh_: xoá (khi ý là ngừng bán), inactive, hidden

**Tệp ảnh** (`Media`):
Ảnh đã tải lên kho lưu trữ, có thể chưa gắn hoặc đã gắn vào một Sản phẩm theo màu.
_Tránh_: asset, file, upload (khi nói về bản ghi)

## Giá & khuyến mãi

**Giá bán** (`Price`):
Giá niêm yết của một Biến thể, số nguyên VND.
_Tránh_: giá gốc, list price

**Giá khuyến mãi** (`SalePrice`):
Giá thấp hơn Giá bán, gắn với một Biến thể trong một khoảng thời gian.
_Tránh_: flash sale, giá sale, discount price

**Giá áp dụng** (`EffectivePrice`):
Giá khuyến mãi nếu đang hiệu lực, ngược lại là Giá bán.
_Tránh_: giá hiện tại, giá cuối

**Mức giảm** (`DiscountRate`):
Tỷ lệ giảm của Giá khuyến mãi so với Giá bán; quyết định quyền Đổi trả.
_Tránh_: % sale

**Voucher** (`Voucher`):
Mã giảm giá áp lên Tạm tính của một Đơn hàng, theo % hoặc số tiền cố định; mỗi đơn tối đa một Voucher.
_Tránh_: coupon, promotion, mã khuyến mãi

**Lượt dùng Voucher** (`VoucherUsage`):
Một lần một Voucher được tính cho một đơn, đếm theo Tài khoản hoặc số điện thoại.
_Tránh_: redemption

## Giỏ hàng

**Giỏ hàng** (`Cart`):
Danh sách Biến thể Người mua định mua, lưu ở server cho cả Khách vãng lai và Khách hàng; không Giữ hàng.
_Tránh_: basket, bag

**Gộp giỏ** (`CartMerge`):
Việc dồn Giỏ hàng vãng lai vào Giỏ hàng của Tài khoản khi Khách vãng lai đăng nhập.
_Tránh_: sync giỏ

## Tồn kho

**Kho** (`Warehouse`):
Nơi chứa hàng thực tế; MVP có đúng một Kho.
_Tránh_: location, chi nhánh

**Tồn kho** (`Stock`):
Số lượng của một Biến thể tại một Kho chưa bị trừ cho đơn nào.
_Tránh_: inventory (chung chung), quantity, số lượng

**Giữ hàng** (`Reservation`):
Phần Tồn kho được giữ có thời hạn 15 phút cho một đơn thanh toán online đang chờ tiền.
_Tránh_: hold, reserved quantity, tạm giữ

**Số lượng bán được** (`AvailableQuantity`):
Tồn kho trừ tổng Giữ hàng còn hiệu lực; không bao giờ âm.
_Tránh_: available stock, còn hàng

**Hàng chờ xuất** (`AwaitingDispatch`):
Hàng đã bán (đã trừ Tồn kho) nhưng chưa Bàn giao, theo dõi theo Mã đơn.
_Tránh_: hàng đã đặt, pending shipment, allocated

**Hàng trên kệ** (`OnShelf`):
Tổng hàng đang nằm trong Kho, bằng Tồn kho cộng Hàng chờ xuất.
_Tránh_: tồn thực tế, physical stock

**Kiểm kê** (`StockCount`):
Việc Staff nhập số đếm thực tế của một Biến thể để điều chỉnh Tồn kho theo chênh lệch với Hàng trên kệ.
_Tránh_: stocktake, audit kho

**Điều chỉnh tồn kho** (`StockAdjustment`):
Một thay đổi Tồn kho thủ công có lý do (nhập kho, hàng lỗi, hàng mẫu, kiểm kê).
_Tránh_: sửa tồn

## Đơn hàng & checkout

**Tính thử** (`Quote`):
Bản tính có hạn của dòng, giá, Voucher, Phí ship và tổng mà Người mua xác nhận trước khi đặt; không Giữ hàng, không cam kết giá.
_Tránh_: preview, cart summary, báo giá

**Đơn hàng** (`Order`):
Cam kết mua của một Người mua, có Mã đơn, Dòng đơn hàng, địa chỉ giao và một phương thức thanh toán.
_Tránh_: purchase, transaction, giao dịch

**Mã đơn** (`OrderCode`):
Mã công khai, ngẫu nhiên, không đoán được của Đơn hàng, dạng `FS<YYMM>-XXXXXX`.
_Tránh_: order id, số đơn

**Dòng đơn hàng** (`OrderLine`):
Một Biến thể và số lượng trong một Đơn hàng, kèm bản chụp tên, SKU, đơn giá, mức giảm và phần Voucher phân bổ lúc đặt.
_Tránh_: order item, line item

**Tạm tính** (`Subtotal`):
Tổng Giá áp dụng × số lượng của mọi Dòng đơn hàng, trước Voucher và Phí ship.
_Tránh_: tổng hàng, item total

**Phí ship** (`ShippingFee`):
Khoản Người mua trả cho giao hàng, lấy từ GHN hoặc Phí ship dự phòng, có thể được miễn theo Ngưỡng miễn phí ship.
_Tránh_: cước vận chuyển (đó là khoản cửa hàng trả GHN), delivery fee

**Tổng tiền đơn** (`OrderTotal`):
Tạm tính − giảm giá Voucher + Phí ship; luôn > 0.
_Tránh_: grand total, thành tiền

**Hạn mức COD** (`CodLimit`):
Giá trị đơn tối đa được chọn COD; vượt thì phải thanh toán online.
_Tránh_: COD cap

**Huỷ đơn** (`Cancellation`):
Chấm dứt cả Đơn hàng trước khi giao xong; không huỷ từng Dòng đơn hàng.
_Tránh_: partial cancel, void

**Hoàn tất** (`Completed`):
Trạng thái cuối của đơn đã giao quá 7 ngày và không còn Đổi trả đang mở; mốc chốt Doanh thu.
_Tránh_: done, closed, đã giao (khác nghĩa)

## Thanh toán & hoàn tiền

**Phương thức thanh toán** (`PaymentMethod`):
COD hoặc online, chốt khi đặt đơn.
_Tránh_: payment type

**Cổng thanh toán** (`PaymentGateway`):
Bên trung gian thu tiền online: VNPay hoặc MoMo.
_Tránh_: payment provider, PSP

**Thanh toán** (`Payment`):
Một lần Người mua trả tiền cho đơn qua một Cổng thanh toán, hoặc khoản thu COD của đơn.
_Tránh_: payment attempt, transaction

**IPN** (`Ipn`):
Thông báo server-to-server từ Cổng thanh toán về kết quả một Thanh toán; là một trong hai nguồn xác nhận tiền về.
_Tránh_: callback, return URL, webhook (khi nói về Cổng thanh toán)

**Đối soát** (`Reconciliation`):
Việc định kỳ hỏi lại Cổng thanh toán hoặc GHN để chốt trạng thái còn treo.
_Tránh_: sync, polling

**Hoàn tiền** (`Refund`):
Việc trả lại tiền cho Người mua, gắn với đúng một Thanh toán đã nhận tiền; MVP do Staff thực hiện thủ công rồi ghi nhận.
_Tránh_: chargeback, trả tiền

**Yêu cầu Hoàn tiền** (`RefundRequest`):
Nghĩa vụ hoàn tiền đã phát sinh nhưng chưa được ghi nhận là đã hoàn.
_Tránh_: refund pending

**Cờ cần xử lý** (`Flag`):
Dấu hiệu gắn lên đơn báo Staff phải can thiệp (tiền sai, tiền về muộn, phí ship dự phòng, Vận đơn lỗi…).
_Tránh_: alert, cảnh báo, issue

## Đổi trả

**Đổi trả** (`Return`):
Yêu cầu trả lại hàng sau khi Đã giao, trong 7 ngày; "đổi" được xử lý như trả hàng cộng đơn mới.
_Tránh_: RMA, exchange, hoàn hàng (khác nghĩa)

**Chấp nhận / Từ chối** (`Accepted` / `Rejected`):
Kết quả Staff xét Đổi trả theo từng dòng; Chấp nhận khi có ít nhất một sản phẩm được nhận.
_Tránh_: approve, duyệt

## Vận chuyển

**Vận đơn** (`Shipment`):
Đơn giao hàng tạo ở GHN cho một Đơn hàng.
_Tránh_: tracking, delivery order

**Bàn giao** (`Handover`):
Việc Staff giao gói hàng cho GHN, kích hoạt tạo Vận đơn.
_Tránh_: dispatch, xuất kho

**Hoàn hàng** (`ReturnedToSender`):
Giao thất bại và GHN trả hàng về Kho; khác với Đổi trả.
_Tránh_: return, trả hàng

**Phí ship dự phòng** (`FallbackShippingFee`):
Phí ship cố định dùng khi không lấy được phí từ GHN.
_Tránh_: phí mặc định

**Ngưỡng miễn phí ship** (`FreeShippingThreshold`):
Mức Tạm tính sau Voucher mà từ đó đơn được miễn Phí ship.
_Tránh_: freeship

**Thu hộ** (`CodAmount`):
Số tiền GHN thu của Người mua khi giao đơn COD, bằng Tổng tiền đơn.
_Tránh_: COD (khi ý là số tiền)

## Thông báo

**Thông báo** (`Notification`):
Tin hệ thống gửi cho Người mua về Đơn hàng hoặc Hoàn tiền của họ; MVP chỉ có một kênh là Email giao dịch.
_Tránh_: alert (đó là Cờ cần xử lý cho Staff), push, tin nhắn marketing

**Email giao dịch** (`TransactionalEmail`):
Thông báo gửi qua email khi đơn đổi trạng thái hoặc Hoàn tiền được ghi nhận, theo ngôn ngữ đã chọn.
_Tránh_: marketing email, newsletter

## Doanh thu

**Doanh thu** (`Revenue`):
Tổng tiền đơn của các đơn Hoàn tất trừ Hoàn tiền của Đổi trả, ghi vào ngày Hoàn tất.
_Tránh_: doanh số, GMV, sales

## Dữ liệu cá nhân

**Đồng ý xử lý dữ liệu** (`Consent`):
Sự chấp thuận của Người mua cho việc xử lý dữ liệu cá nhân, ghi lại lúc thu thập.
_Tránh_: accept terms

**Yêu cầu xoá dữ liệu** (`ErasureRequest`):
Yêu cầu của Người mua xoá hoặc ẩn danh dữ liệu cá nhân, trong giới hạn nghĩa vụ lưu trữ pháp lý.
_Tránh_: delete account

**Ẩn danh hoá** (`Anonymization`):
Thay dữ liệu định danh bằng giá trị không truy ngược được, giữ bản ghi cho thống kê và nghĩa vụ kế toán.
_Tránh_: soft delete, xoá mềm
