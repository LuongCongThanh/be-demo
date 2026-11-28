# Traceability Backend: luật → kịch bản → tầng

**Trạng thái:** Đã chốt cho MVP (2026-11-28). Luật gốc: [02-actors-permissions.md](../business/02-actors-permissions.md), [04-business-rules.md](../business/04-business-rules.md), [05-order-lifecycle.md](../business/05-order-lifecycle.md), [06-compliance.md](../business/06-compliance.md). Cách chọn tầng: [strategy.md](strategy.md). Kịch bản của handbook không có luật tương ứng (N/A, khoảng trống cần BA) ghi ở `docs/testing/handbook-mapping.md` của repo workspace.

Cột:

- **Tầng**: **U** unit, **A** API, **I** integration DB, **C** đồng thời, **J** hành trình full-stack (mã J ở repo workspace).
- **Mức**: theo nhóm luật (P0 `ORD`, `INV`, `VCH`, `PRC`, `PAY`, `REF`, xác thực, phân quyền, lộ dữ liệu; P1 `CRT`, `CAT`, `SHP`, `RET`, `NTF`, `REV`; P2 tìm kiếm, sắp xếp, bản dịch).
- **Task**: task trong `docs/plan/tasks/` phải làm cho dòng này đạt. `—`: không gắn với task nào đang mở. Trạng thái implement của task xem trong `docs/plan/`.
- **Test**: chỉ trạng thái test. `Not assessed` = chưa audit, không có nghĩa là chưa có test. `PASS` chỉ ghi khi có test trỏ tới luật và có bằng chứng chạy (commit, lệnh).

## Danh mục, Sản phẩm (`CAT` P1), Giá khuyến mãi (`PRC` P0)

| Mã                            | Kịch bản                                                                                                                        | Tầng    | Mức | Task | Test         |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------- | --- | ---- | ------------ |
| BR-CAT-01, BR-CAT-02          | Sản phẩm không Biến thể bị từ chối; hai Biến thể trùng size × màu bị từ chối (unique ở DB); thiếu size dùng `FREESIZE`          | U, I    | P1  | —    | Not assessed |
| BR-CAT-03                     | SKU sai định dạng bị từ chối; SKU trùng toàn hệ thống bị từ chối; đổi SKU đã có đơn bị từ chối                                  | U, A, I | P1  | —    | Not assessed |
| BR-CAT-04                     | Giá 0, âm, số lẻ bị từ chối                                                                                                     | U, A    | P1  | —    | Not assessed |
| BR-CAT-05                     | Ảnh gắn theo màu: mọi size cùng màu trả cùng bộ ảnh                                                                             | A       | P1  | —    | Not assessed |
| BR-CAT-06                     | Sản phẩm thiếu cân nặng bị từ chối                                                                                              | U, A    | P1  | —    | Not assessed |
| BR-CAT-07, BR-CAT-08          | Storefront chỉ thấy `active`; `draft` và `archived` trả 404; hết hàng vẫn hiện, không thêm giỏ được                             | A, J0   | P1  | —    | Not assessed |
| BR-CAT-09                     | Xoá Sản phẩm hoặc Biến thể đã có đơn bị từ chối; `archived` không làm đổi Dòng đơn hàng cũ                                      | A, I    | P1  | —    | Not assessed |
| BR-CAT-11                     | Size hoặc màu đã dùng chỉ ẩn được, không xoá được                                                                               | A       | P1  | —    | Not assessed |
| BR-CAT-12                     | Bán chạy chỉ tính đơn đã vào `PLACED`, chưa huỷ, không Hoàn hàng, trong 30 ngày                                                 | I       | P2  | —    | Not assessed |
| BR-CAT-13                     | Tìm theo chuỗi con, không phân biệt hoa thường và dấu; từ khoá rỗng hoặc toàn khoảng trắng = không lọc                          | U, A    | P2  | —    | Not assessed |
| BR-CAT-14, BR-CAT-15          | Lọc Nam/Nữ gồm Unisex, Trẻ em thì không; lọc danh mục gồm mọi danh mục con cháu, bỏ nhánh ẩn; phân trang không trùng, không sót | A       | P1  | —    | Not assessed |
| Category (bổ sung 2026-11-19) | Slug ổn định khi đổi tên hoặc cha; ẩn danh mục ẩn cả nhánh, đọc nhánh ẩn trả 404; đổi cha đồng thời không tạo vòng              | U, A, C | P1  | —    | Not assessed |
| BR-CAT-10                     | Bản dịch Anh tự dịch nền, sửa tay được, thiếu thì dùng tiếng Việt; đổi tên Việt giữ bản Anh sửa tay và đánh dấu rà soát         | U, A    | P2  | —    | Not assessed |
| BR-PRC-01, BR-PRC-02          | Giá khuyến mãi ≥ Giá bán bị từ chối; hai Giá khuyến mãi chồng thời gian trên một Biến thể bị từ chối, kể cả song song           | U, A, C | P0  | —    | Not assessed |
| BR-PRC-03                     | Giá áp dụng ngay trước, đúng và sau mốc bắt đầu và kết thúc (qua `Clock`)                                                       | U       | P0  | —    | Not assessed |
| BR-PRC-04                     | Mức giảm tính chính xác không làm tròn; đúng 50% và trên 50% (dùng cho BR-RET-03)                                               | U       | P0  | —    | Not assessed |
| BR-PRC-05, BR-PRC-06          | Hạ Giá bán ≤ Giá khuyến mãi đang hoặc sắp hiệu lực bị từ chối; sửa theo trạng thái sắp, đang, đã kết thúc                       | U, A    | P0  | —    | Not assessed |

## Voucher (`VCH` P0)

| Mã                   | Kịch bản                                                                                                               | Tầng         | Mức | Task | Test         |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------ | --- | ---- | ------------ |
| BR-VCH-01            | Đơn gửi hai Voucher bị từ chối                                                                                         | A            | P0  | —    | Not assessed |
| BR-VCH-02, BR-VCH-05 | Voucher tính trên Tạm tính đã dùng Giá áp dụng; không giảm phí ship                                                    | U            | P0  | —    | Not assessed |
| BR-VCH-03            | Chỉ nhận hai kiểu: % (mức giảm tối đa tuỳ chọn) hoặc số tiền cố định; kiểu khác bị từ chối                             | U, A         | P0  | —    | Not assessed |
| BR-VCH-04            | Bảng quyết định: hiệu lực × đơn tối thiểu (dưới, bằng, trên) × tổng lượt × lượt mỗi Người mua; mốc hết hạn qua `Clock` | U, A         | P0  | —    | Not assessed |
| BR-VCH-06, BR-VCH-10 | % làm tròn xuống trước khi áp mức tối đa và giới hạn Tạm tính; cố định dùng `min(value, subtotal)`; không số thực      | U (mutation) | P0  | —    | Not assessed |
| BR-VCH-07            | Lượt đếm theo Tài khoản **hoặc** số điện thoại: Khách hàng hết lượt đặt lại như Khách vãng lai cùng số bị từ chối      | A            | P0  | —    | Not assessed |
| BR-VCH-04, BR-VCH-07 | Hai đơn cùng lúc dùng lượt cuối (tổng và mỗi Người mua): đúng một đơn thành công                                       | C            | P0  | —    | Not assessed |
| BR-VCH-08            | Huỷ trước `SHIPPING` trả lượt; huỷ ở T14 không trả lượt                                                                | A            | P0  | 31   | Not assessed |
| BR-VCH-09            | `sale10` và `SALE10` là một mã                                                                                         | U, A         | P0  | —    | Not assessed |
| BR-VCH-11            | Đã có lượt: chỉ sửa được hạn, tổng lượt (không dưới số đã dùng), lượt mỗi Người mua, bật/tắt; xoá bị từ chối           | A            | P0  | —    | Not assessed |

## Tồn kho (`INV` P0)

| Mã        | Kịch bản                                                                                                    | Tầng  | Mức | Task | Test         |
| --------- | ----------------------------------------------------------------------------------------------------------- | ----- | --- | ---- | ------------ |
| BR-INV-01 | Tồn kho theo Biến thể × Kho; mọi thao tác MVP dùng đúng một Kho mặc định                                    | A     | P0  | —    | Not assessed |
| BR-INV-02 | Số lượng bán được = Tồn kho − Giữ hàng còn hiệu lực, không bao giờ âm (property-based)                      | U, I  | P0  | —    | Not assessed |
| BR-INV-02 | Hai người mua món cuối cùng lúc: đúng một đơn, còn 0, không Order hoặc Giữ hàng mồ côi                      | C     | P0  | —    | Not assessed |
| BR-INV-03 | Thêm vào giỏ không đổi Số lượng bán được                                                                    | A     | P0  | —    | Not assessed |
| BR-INV-04 | Đơn COD trừ Tồn kho và ghi Hàng chờ xuất trong cùng transaction với Order; lỗi giữa chừng thì không còn gì  | A, I  | P0  | —    | Not assessed |
| BR-INV-05 | Đơn online tạo Giữ hàng 15 phút; hết hạn thì giải phóng; không tạo link mới từ phút 7; link hết hạn phút 10 | U, A  | P0  | 29   | Not assessed |
| BR-INV-06 | Một dòng thiếu hàng: không tạo đơn, trả Biến thể nào thiếu và còn bao nhiêu                                 | A, J2 | P0  | —    | Not assessed |
| BR-INV-07 | Huỷ trước `SHIPPING` trả Hàng chờ xuất về Tồn kho một lần, kể cả khi lệnh huỷ chạy lại                      | A, I  | P0  | 31   | Not assessed |
| BR-INV-08 | Hoàn hàng cộng Tồn kho khi Staff xác nhận nhận về; Đổi trả chỉ cộng phần được chấp nhận và chọn nhập lại    | A     | P0  | 34   | Not assessed |
| BR-INV-09 | Mọi thay đổi Tồn kho có dòng lịch sử (loại, số lượng, đơn, người thực hiện); tổng lịch sử khớp Tồn kho      | I     | P0  | 51   | Not assessed |
| BR-INV-10 | Hàng chờ xuất xoá khi Vận đơn tạo xong; Hàng trên kệ = Tồn kho + Hàng chờ xuất                              | U, A  | P0  | 32   | Not assessed |
| BR-INV-11 | Giảm vượt Số lượng bán được bị từ chối kèm số tối đa; điều chỉnh đồng thời không làm âm                     | A, C  | P0  | —    | Not assessed |
| BR-INV-12 | Kiểm kê tính chênh lệch tại lúc xác nhận; xác nhận đồng thời không lệch (`stock-count-confirm-race`)        | A, C  | P0  | —    | Not assessed |

## Giỏ hàng (`CRT` P1)

| Mã                   | Kịch bản                                                                                              | Tầng    | Mức | Task | Test         |
| -------------------- | ----------------------------------------------------------------------------------------------------- | ------- | --- | ---- | ------------ |
| BR-CRT-01, BR-CRT-02 | Giỏ vãng lai lưu server; hết hạn sau 30 ngày không hoạt động (qua `Clock`)                            | A       | P1  | —    | Not assessed |
| BR-CRT-03            | Gộp khi đăng nhập: cộng dồn, không vượt Số lượng bán được, không vượt 10; gộp hai lần không cộng thêm | A, J4   | P1  | —    | Not assessed |
| BR-CRT-04            | Giá trong giỏ là Giá áp dụng hiện tại; giá đổi thì response báo cho Người mua                         | A       | P1  | —    | Not assessed |
| BR-CRT-05            | Số lượng 10 được, 11, 0, âm bị từ chối; hai request cộng cùng lúc không vượt 10                       | U, A, C | P1  | —    | Not assessed |
| Ownership giỏ        | Đọc hoặc sửa giỏ của người khác bị từ chối                                                            | A       | P0  | —    | Not assessed |

## Đặt hàng (`ORD` P0) và vòng đời Đơn hàng

| Mã             | Kịch bản                                                                                                                                             | Tầng         | Mức | Task   | Test         |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | --- | ------ | ------------ |
| BR-ORD-01      | Tổng = Tạm tính − Voucher + phí ship, tính bằng số nguyên                                                                                            | U            | P0  | —      | Not assessed |
| BR-ORD-02      | Phân bổ Voucher theo `variant_id`, phần dư dồn dòng cuối và chuyển ngược khi vượt; ví dụ 500/501đ và ba dòng 1đ; property-based                      | U (mutation) | P0  | —      | Not assessed |
| BR-ORD-02      | Sửa Sản phẩm, giá, Voucher sau khi đặt không đổi bản chụp trên Dòng đơn hàng                                                                         | A            | P0  | —      | Not assessed |
| BR-ORD-03      | Mã đơn đúng `FS<YYMM>-` + 6 ký tự; không tuần tự; va chạm mã thì sinh lại                                                                            | U            | P0  | —      | Not assessed |
| BR-ORD-04      | Địa chỉ thiếu tỉnh hoặc phường/xã, mã không hợp lệ bị từ chối                                                                                        | A            | P0  | —      | Not assessed |
| BR-ORD-05      | Không có API huỷ từng Dòng đơn hàng; huỷ luôn áp cho cả đơn                                                                                          | A            | P0  | 31, 33 | Not assessed |
| BR-ORD-06      | Luật huỷ và chuyển trạng thái: xem các dòng T1–T14 dưới đây                                                                                          | —            | P0  | —      | —            |
| BR-ORD-07      | Đặt đơn khác Tính thử ở bất kỳ điểm nào (dòng, giá, điều kiện) bị từ chối kể cả cùng tổng; Tính thử hết hạn bị từ chối                               | U, A, J2     | P0  | —      | Not assessed |
| BR-ORD-08      | Đơn vãng lai gắn vào Tài khoản cùng email (không phân biệt hoa thường) khi email được xác thực; không gắn theo số điện thoại                         | A            | P0  | 30     | Not assessed |
| BR-ORD-09      | Tổng = 0 hoặc âm, giỏ rỗng bị từ chối; không tạo Order, Payment, Giữ hàng, Hàng chờ xuất, lượt Voucher                                               | U, A         | P0  | —      | Not assessed |
| Idempotency    | Cùng key + cùng payload: một đơn; cùng key + khác payload: từ chối; hai request cùng key song song: một đơn; thử lại sau timeout trả đúng đơn đã tạo | A, C, J1     | P0  | —      | Not assessed |
| Rollback       | Lỗi DB giữa Order, Dòng đơn hàng, trừ Tồn kho, lượt Voucher: không commit dở; deadlock (P2034) được caller thử lại an toàn                           | I            | P0  | —      | Not assessed |
| Outbox         | Sự kiện ghi cùng transaction với Order (ADR 0003); worker chết giữa chừng thì chạy lại không tạo tác động trùng (ADR 0007)                           | I            | P0  | —      | Not assessed |
| T2             | Đặt COD hợp lệ → `PLACED`, khoản thu COD, email; vượt hạn mức COD (BR-PAY-06) bị từ chối                                                             | A, J1        | P0  | —      | Not assessed |
| T1, T3–T5      | Online → `PENDING_PAYMENT`; IPN đúng số tiền → `PLACED`; hết 15 phút → `CANCELLED`, job chạy lại không huỷ hai lần; Người mua tự huỷ                 | U, A, J6     | P0  | 29     | Not assessed |
| T6–T9          | Staff xác nhận, đóng gói; huỷ từ `PLACED`, `CONFIRMED`, `PACKING` có lý do; Người mua không huỷ được từ `PACKING`                                    | U, A, J5     | P0  | 31, 33 | Not assessed |
| T10–T14        | Vận đơn tạo xong → `SHIPPING`; giao → `DELIVERED`; Hoàn hàng; 7 ngày → `COMPLETED`; T14 chỉ khi Vận đơn sự cố                                        | U, A, J8     | P0  | 32, 34 | Not assessed |
| Bảng T1–T14    | Mọi cặp trạng thái không có trong bảng bị từ chối (sinh từ bảng, không viết tay từng cặp)                                                            | U            | P0  | —      | Not assessed |
| Mục 4.1, 4.2   | Tiền về khi đơn không còn chờ: giữ trạng thái, tự tạo Hoàn tiền; IPN và webhook GHN sai thứ tự, lặp, mâu thuẫn                                       | U, A         | P0  | 29, 32 | Not assessed |
| Mục 4.5        | Huỷ khi Vận đơn `creating`, `creation_unknown` bị từ chối; GHN tạo xong cho đơn đã huỷ thì tự huỷ Vận đơn                                            | A            | P0  | 32     | Not assessed |
| US-401, US-402 | Người mua chỉ đọc đơn của mình; Khách vãng lai cần Mã đơn + số điện thoại; sai một trong hai trả như không tồn tại                                   | A, J7        | P0  | 30     | Not assessed |

## Thanh toán (`PAY` P0), Hoàn tiền (`REF` P0)

| Mã                   | Kịch bản                                                                                                                                                             | Tầng  | Mức | Task       | Test         |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | --- | ---------- | ------------ |
| BR-PAY-01            | Thử lại bằng Cổng khác khi còn chờ thanh toán; đơn COD không tạo link                                                                                                | A, J6 | P0  | 29         | Not assessed |
| BR-PAY-02            | Return URL không đổi trạng thái; chỉ IPN hoặc job Đối soát; Đối soát phát hiện lệch và cập nhật đúng                                                                 | A     | P0  | 29         | Not assessed |
| Chữ ký               | IPN sai chữ ký hoặc secret khác: từ chối, không đổi gì; log không chứa secret hay dữ liệu thẻ                                                                        | U, A  | P0  | 29         | Not assessed |
| BR-PAY-03            | IPN lặp (cùng mã giao dịch) xử lý một lần; hai IPN song song xử lý một lần                                                                                           | A, C  | P0  | 29         | Not assessed |
| BR-PAY-04            | Số tiền captured khác Tổng tiền: không xác nhận, Cờ cần xử lý, tự tạo Hoàn tiền; failed, pending không xác nhận đơn và không tạo nghĩa vụ hoàn                       | U, A  | P0  | 29         | Not assessed |
| BR-PAY-05            | Tiền về cho đơn đã huỷ hoặc đã trả: đơn giữ nguyên, tạo Hoàn tiền, email báo hoàn                                                                                    | A     | P0  | 29         | Not assessed |
| Timeout              | Cổng timeout khi tạo link hoặc truy vấn: không tạo Payment trùng; Đối soát xác định kết quả                                                                          | A     | P0  | 29         | Not assessed |
| BR-REF-01, BR-REF-05 | Hoàn tiền gắn đúng Thanh toán và Cổng; số tiền theo từng trường hợp (huỷ, Hoàn hàng, BR-PAY-04, BR-PAY-05)                                                           | U, A  | P0  | 34         | Not assessed |
| BR-REF-02            | Mỗi nguồn phát sinh (huỷ đơn đã trả online, Hoàn hàng đơn online, Đổi trả được chấp nhận, BR-PAY-04, BR-PAY-05) tạo đúng một yêu cầu Hoàn tiền; nguồn khác không tạo | A     | P0  | 29, 31, 34 | Not assessed |
| BR-REF-03            | Ghi nhận "Đã hoàn tiền" bắt buộc mã giao dịch hoàn                                                                                                                   | A     | P0  | 34         | Not assessed |
| BR-REF-04            | Huỷ COD trước giao không tạo Hoàn tiền                                                                                                                               | A     | P0  | 31         | Not assessed |
| BR-REF-06            | Khoá `(payment_id, reason, return_id)`: xử lý lại không tạo thêm; tổng hoàn không vượt số đã nhận, kể cả song song                                                   | A, C  | P0  | 34         | Not assessed |

## Vận chuyển (`SHP` P1), Đổi trả (`RET` P1), Thông báo (`NTF` P1), Doanh thu (`REV` P1)

| Mã                   | Kịch bản                                                                                                                                                          | Tầng | Mức | Task | Test         |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | --- | ---- | ------------ |
| BR-SHP-01, BR-SHP-02 | Phí theo cân nặng × số lượng; GHN lỗi hoặc timeout → phí dự phòng + Cờ cần xử lý                                                                                  | U, A | P1  | 32   | Not assessed |
| BR-SHP-03            | Miễn phí ship theo Tạm tính **sau** Voucher: 499.999, 500.000, 500.001                                                                                            | U    | P1  | —    | Not assessed |
| BR-SHP-04            | Chỉ Admin sửa được Phí ship dự phòng và Ngưỡng miễn phí ship                                                                                                      | A    | P1  | —    | Not assessed |
| BR-SHP-05, BR-SHP-06 | Bàn giao tạo Vận đơn một lần; bàn giao lại dùng lại Vận đơn; webhook GHN và Đối soát cập nhật trạng thái                                                          | A    | P1  | 32   | Not assessed |
| BR-SHP-07, BR-SHP-08 | COD thu hộ = Tổng tiền; Vận đơn sự cố gắn Cờ cần xử lý, cho phép T14 có lý do                                                                                     | A    | P1  | 32   | Not assessed |
| BR-RET-01            | Yêu cầu ở đúng 7 × 24 giờ được, sau 1 giây bị từ chối (qua `Clock`)                                                                                               | U, A | P1  | 34   | Not assessed |
| BR-RET-02            | Điều kiện còn tag, chưa sử dụng do Staff đánh giá khi Chấp nhận theo dòng (BR-RET-08); hệ thống không tự kiểm. Nếu BA muốn lưu kết quả đánh giá thì thêm kịch bản | —    | P1  | 34   | —            |
| BR-RET-03            | Hàng giảm trên 50% không Đổi trả được; đúng 50% được                                                                                                              | U    | P1  | 34   | Not assessed |
| BR-RET-04            | Chỉ Staff tạo yêu cầu Đổi trả trong back-office; Người mua không có API tạo yêu cầu                                                                               | A    | P1  | 34   | Not assessed |
| BR-RET-05            | "Đổi" xử lý như trả + đơn mới: không có API đổi Biến thể trên đơn cũ                                                                                              | A    | P1  | 34   | Not assessed |
| BR-RET-06            | Phí ship gửi trả không làm đổi số hoàn của Đổi trả (BR-RET-07 không hoàn Phí ship)                                                                                | A    | P1  | 34   | Not assessed |
| BR-RET-07            | Hoàn lũy kế `F(k)`; ví dụ 3 × 200.000đ, Voucher 60.000đ, trả 1 → 180.000đ; trả lần lượt 99, 100, 100đ; tổng hoàn 0đ không tạo Hoàn tiền; property-based           | U, A | P1  | 34   | Not assessed |
| BR-RET-08            | Chấp nhận theo dòng 0 tới số gửi trả; không dòng nào → Từ chối; hai yêu cầu song song không dùng chung mốc `k`                                                    | A, C | P1  | 34   | Not assessed |
| BR-RET-09            | Hàng không được chấp nhận: yêu cầu lưu ghi chú gửi lại, không đổi Tồn kho                                                                                         | A    | P1  | 34   | Not assessed |
| Mục 4.4              | Đơn chưa `COMPLETED` khi còn Đổi trả đang mở, kể cả đã quá 7 ngày                                                                                                 | A    | P1  | 34   | Not assessed |
| BR-NTF-01            | Email đúng sự kiện; đơn online chưa trả không nhận email kể cả khi huỷ; job chạy lại không gửi trùng; email không chứa dữ liệu thừa                               | A    | P1  | 35   | Not assessed |
| BR-NTF-02, BR-NTF-03 | Email theo ngôn ngữ đã chọn; Khách vãng lai không email thì không gửi                                                                                             | A    | P1  | 35   | Not assessed |
| BR-REV-01, BR-REV-02 | Doanh thu theo ngày Hoàn tất giờ Việt Nam (đơn hoàn tất 23:59 và 00:00); trừ Hoàn tiền Đổi trả, không trừ BR-PAY-04, BR-PAY-05                                    | U, A | P1  | 36   | Not assessed |

## Xác thực, phân quyền, dữ liệu cá nhân (P0)

| Mã                        | Kịch bản                                                                                                                               | Tầng  | Mức | Task | Test         |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ----- | --- | ---- | ------------ |
| US-501                    | Email trùng (không phân biệt hoa thường) bị từ chối; token xác thực hết hạn hoặc dùng lại bị từ chối                                   | A     | P0  | —    | Not assessed |
| US-502                    | Sai mật khẩu và rate limit; refresh rotation: refresh token cũ dùng lại thì thu hồi phiên                                              | A     | P0  | —    | Not assessed |
| US-503                    | Quên mật khẩu trả cùng response cho email có và không có Tài khoản                                                                     | A     | P0  | —    | Not assessed |
| Ma trận quyền (mục 3.2)   | Mỗi hành động Admin-only gọi bằng Staff → 403; không đăng nhập → 401; sinh test từ ma trận                                             | A     | P0  | —    | Not assessed |
| Ownership                 | Người mua không đọc hay sửa đơn, giỏ, địa chỉ, hồ sơ của người khác (đổi id trong URL)                                                 | A, J7 | P0  | —    | Not assessed |
| Mass assignment           | Gửi thêm `role`, `status`, `price` trong body không có tác dụng                                                                        | A     | P0  | —    | Not assessed |
| Staff tự nâng quyền       | Staff không sửa được Vai trò của mình hay của người khác                                                                               | A     | P0  | —    | Not assessed |
| Quy tắc kiểm soát (mục 4) | Vô hiệu hoá Tài khoản Staff thu hồi ngay mọi phiên: request kế tiếp bằng token cũ bị 401                                               | A     | P0  | —    | Not assessed |
| Quy tắc kiểm soát (mục 4) | Mọi thao tác ghi trên back-office có lịch sử ai, lúc nào, trước, sau; điều chỉnh Tồn kho và Staff huỷ đơn thiếu lý do bị từ chối       | A, I  | P1  | —    | Not assessed |
| CMP-04                    | Khách hàng chỉ xem và sửa dữ liệu cá nhân của chính mình                                                                               | A     | P0  | 37   | Not assessed |
| CMP-05                    | Yêu cầu xoá chỉ xử lý khi mọi đơn ở trạng thái cuối và không còn Hoàn tiền chờ; ẩn danh đúng các trường, giữ dữ liệu kế toán           | A, I  | P0  | 36   | Not assessed |
| CMP-07                    | Staff mở chi tiết Khách hàng, chi tiết Đơn hàng, tìm đơn theo số điện thoại đều có lịch sử; mở danh sách đơn thì không                 | A     | P0  | 36   | Not assessed |
| CMP-01, CMP-02, CMP-03    | Đăng ký và checkout thiếu đồng ý bị từ chối; lưu bằng chứng (phiên bản chính sách, thời điểm, kênh, người); đồng ý marketing lưu riêng | A     | P1  | —    | Not assessed |
| CMP-06                    | Yêu cầu xoá lưu thời điểm nhận và hoàn thành                                                                                           | A     | P1  | 36   | Not assessed |
| CMP-08, CMP-09            | N/A cho test: hồ sơ pháp lý và quy trình thông báo sự cố, không phải hành vi của hệ thống                                              | —     | —   | —    | —            |
