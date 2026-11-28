# Traceability Backend: luật → kịch bản → tầng

**Trạng thái:** Đã chốt cho MVP (2026-11-28). Luật gốc: [04-business-rules.md](../business/04-business-rules.md), [05-order-lifecycle.md](../business/05-order-lifecycle.md), [02-actors-permissions.md](../business/02-actors-permissions.md). Cách chọn tầng: [strategy.md](strategy.md).

Cột **Trạng thái test**:

- `Not assessed`: tính năng đã có trên `dev`, chưa audit xem test hiện có đủ chưa. Không có nghĩa là chưa có test.
- `Chưa build (task NN)`: tính năng chưa có; task đó phải làm dòng này. Trạng thái implement theo dõi trong `docs/plan/`.
- `PASS`: chỉ ghi khi đã có test trỏ tới luật và có bằng chứng chạy (commit, lệnh).

Tầng viết tắt: **U** unit, **A** API, **I** integration DB, **C** đồng thời, **J** hành trình full-stack (mã J ở repo workspace).

## Danh mục, Sản phẩm, Giá (`CAT` P1, `PRC` P0)

| Mã                             | Kịch bản                                                                                                                                                            | Tầng    | Mức | Trạng thái test |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | --- | --------------- |
| BR-CAT-01/02                   | Sản phẩm không Biến thể bị từ chối; hai Biến thể trùng size × màu bị từ chối (unique ở DB)                                                                          | U, I    | P1  | Not assessed    |
| BR-CAT-03                      | SKU sai định dạng bị từ chối; SKU trùng toàn hệ thống bị từ chối; đổi SKU đã có đơn bị từ chối                                                                      | U, A, I | P1  | Not assessed    |
| BR-CAT-04                      | Giá 0, âm, số lẻ bị từ chối                                                                                                                                         | U, A    | P0  | Not assessed    |
| BR-CAT-07/08                   | Storefront chỉ thấy `active`; `draft` và `archived` trả 404; hết hàng vẫn hiện, không thêm giỏ                                                                      | A, J0   | P1  | Not assessed    |
| BR-CAT-09                      | Xoá Sản phẩm hoặc Biến thể đã có đơn bị từ chối; `archived` không làm đổi Dòng đơn hàng cũ                                                                          | A, I    | P1  | Not assessed    |
| BR-CAT-11                      | Size hoặc màu đã dùng chỉ ẩn được, không xoá được                                                                                                                   | A       | P1  | Not assessed    |
| BR-CAT-12                      | Bán chạy chỉ tính đơn đã vào `PLACED`, chưa huỷ, không Hoàn hàng, trong 30 ngày                                                                                     | I       | P2  | Not assessed    |
| BR-CAT-13                      | Tìm theo chuỗi con, không phân biệt hoa thường và dấu; từ khoá rỗng hoặc toàn khoảng trắng = không lọc                                                              | U, A    | P2  | Not assessed    |
| BR-CAT-14/15                   | Lọc Nam/Nữ gồm Unisex, Trẻ em thì không; lọc danh mục gồm mọi danh mục con cháu, bỏ nhánh ẩn                                                                        | A       | P1  | Not assessed    |
| BR-CAT-10, category 2026-11-19 | Slug ổn định khi đổi tên hoặc cha; ẩn danh mục ẩn cả nhánh; đổi tên Việt giữ bản Anh sửa tay và đánh dấu rà soát; vòng lặp cha con bị từ chối khi đổi cha đồng thời | U, A, C | P2  | Not assessed    |
| BR-PRC-01/02                   | Giá khuyến mãi ≥ Giá bán bị từ chối; hai Giá khuyến mãi chồng thời gian trên một Biến thể bị từ chối                                                                | U, A, C | P0  | Not assessed    |
| BR-PRC-03                      | Giá áp dụng ngay trước, đúng và sau mốc bắt đầu và kết thúc (qua `Clock`)                                                                                           | U       | P0  | Not assessed    |
| BR-PRC-04                      | Mức giảm tính chính xác không làm tròn; đúng 50% và trên 50% (dùng cho BR-RET-03)                                                                                   | U       | P0  | Not assessed    |
| BR-PRC-05/06                   | Hạ Giá bán ≤ Giá khuyến mãi đang hoặc sắp hiệu lực bị từ chối; sửa theo trạng thái sắp / đang / đã kết thúc                                                         | U, A    | P0  | Not assessed    |

## Voucher (`VCH` P0)

| Mã           | Kịch bản                                                                                                                 | Tầng         | Mức | Trạng thái test |
| ------------ | ------------------------------------------------------------------------------------------------------------------------ | ------------ | --- | --------------- |
| BR-VCH-01    | Đơn gửi hai Voucher bị từ chối                                                                                           | A            | P0  | Not assessed    |
| BR-VCH-02/05 | Voucher tính trên Tạm tính đã dùng Giá áp dụng; không giảm phí ship                                                      | U            | P0  | Not assessed    |
| BR-VCH-04    | Bảng quyết định: hiệu lực × đơn tối thiểu (dưới / bằng / trên) × tổng lượt × lượt mỗi Người mua; mốc hết hạn qua `Clock` | U, A         | P0  | Not assessed    |
| BR-VCH-06/10 | % làm tròn xuống trước khi áp mức tối đa và giới hạn Tạm tính; cố định dùng `min(value, subtotal)`; không số thực        | U (mutation) | P0  | Not assessed    |
| BR-VCH-07    | Lượt đếm theo Tài khoản **hoặc** số điện thoại: Khách hàng hết lượt đặt lại như Khách vãng lai cùng số bị từ chối        | A            | P0  | Not assessed    |
| BR-VCH-07/04 | Hai đơn cùng lúc dùng lượt cuối (tổng và mỗi Người mua): đúng một đơn thành công                                         | C            | P0  | Not assessed    |
| BR-VCH-08    | Huỷ trước `SHIPPING` trả lượt; huỷ ở T14 không trả lượt                                                                  | A            | P0  | Not assessed    |
| BR-VCH-09    | `sale10` và `SALE10` là một mã                                                                                           | U, A         | P0  | Not assessed    |
| BR-VCH-11    | Đã có lượt: chỉ sửa được hạn, tổng lượt (không dưới số đã dùng), lượt mỗi Người mua, bật/tắt; xoá bị từ chối             | A            | P0  | Not assessed    |

## Tồn kho (`INV` P0)

| Mã        | Kịch bản                                                                                                    | Tầng  | Mức | Trạng thái test      |
| --------- | ----------------------------------------------------------------------------------------------------------- | ----- | --- | -------------------- |
| BR-INV-02 | Số lượng bán được = Tồn kho − Giữ hàng còn hiệu lực, không bao giờ âm (property-based)                      | U, I  | P0  | Not assessed         |
| BR-INV-02 | Hai người mua món cuối cùng lúc: đúng một đơn, còn 0, không Order hoặc Giữ hàng mồ côi                      | C     | P0  | Not assessed         |
| BR-INV-03 | Thêm vào giỏ không đổi Số lượng bán được                                                                    | A     | P0  | Not assessed         |
| BR-INV-04 | Đơn COD trừ Tồn kho và ghi Hàng chờ xuất trong cùng transaction với Order; lỗi giữa chừng thì không còn gì  | A, I  | P0  | Not assessed         |
| BR-INV-05 | Đơn online tạo Giữ hàng 15 phút; hết hạn thì giải phóng; không tạo link mới từ phút 7; link hết hạn phút 10 | U, A  | P0  | Chưa build (task 29) |
| BR-INV-06 | Một dòng thiếu hàng: không tạo đơn, trả Biến thể nào thiếu và còn bao nhiêu                                 | A, J2 | P0  | Not assessed         |
| BR-INV-07 | Huỷ trước `SHIPPING` trả Hàng chờ xuất về Tồn kho một lần, kể cả khi lệnh huỷ chạy lại                      | A, I  | P0  | Not assessed         |
| BR-INV-08 | Hoàn hàng cộng Tồn kho khi Staff xác nhận nhận về; Đổi trả chỉ cộng phần được chấp nhận và chọn nhập lại    | A     | P0  | Chưa build (task 34) |
| BR-INV-09 | Mọi thay đổi Tồn kho có dòng lịch sử (loại, số lượng, đơn, người thực hiện); tổng lịch sử khớp Tồn kho      | I     | P0  | Chưa build (task 51) |
| BR-INV-10 | Hàng chờ xuất xoá khi Vận đơn tạo xong; Hàng trên kệ = Tồn kho + Hàng chờ xuất                              | U, A  | P0  | Chưa build (task 32) |
| BR-INV-11 | Giảm vượt Số lượng bán được bị từ chối kèm số tối đa; điều chỉnh đồng thời không làm âm                     | A, C  | P0  | Not assessed         |
| BR-INV-12 | Kiểm kê tính chênh lệch tại lúc xác nhận; xác nhận đồng thời không lệch (`stock-count-confirm-race`)        | A, C  | P0  | Not assessed         |

## Giỏ hàng (`CRT` P1)

| Mã           | Kịch bản                                                                                              | Tầng    | Mức | Trạng thái test |
| ------------ | ----------------------------------------------------------------------------------------------------- | ------- | --- | --------------- |
| BR-CRT-01/02 | Giỏ vãng lai lưu server; hết hạn sau 30 ngày không hoạt động (qua `Clock`)                            | A       | P1  | Not assessed    |
| BR-CRT-03    | Gộp khi đăng nhập: cộng dồn, không vượt Số lượng bán được, không vượt 10; gộp hai lần không cộng thêm | A, J4   | P1  | Not assessed    |
| BR-CRT-04    | Giá trong giỏ là Giá áp dụng hiện tại; giá đổi thì response báo cho Người mua                         | A       | P1  | Not assessed    |
| BR-CRT-05    | Số lượng 10 được, 11 / 0 / âm bị từ chối; hai request cộng cùng lúc không vượt 10                     | U, A, C | P1  | Not assessed    |
| Ownership    | Đọc hoặc sửa giỏ của người khác bị từ chối                                                            | A       | P0  | Not assessed    |

## Đặt hàng (`ORD` P0) và vòng đời Đơn hàng

| Mã           | Kịch bản                                                                                                                        | Tầng         | Mức | Trạng thái test          |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------- | ------------ | --- | ------------------------ |
| BR-ORD-01    | Tổng = Tạm tính − Voucher + phí ship, tính bằng số nguyên                                                                       | U            | P0  | Not assessed             |
| BR-ORD-02    | Phân bổ Voucher theo `variant_id`, phần dư dồn dòng cuối và chuyển ngược khi vượt; ví dụ 500/501đ và ba dòng 1đ; property-based | U (mutation) | P0  | Not assessed             |
| BR-ORD-02    | Sửa Sản phẩm, giá, Voucher sau khi đặt không đổi bản chụp trên Dòng đơn hàng                                                    | A            | P0  | Not assessed             |
| BR-ORD-03    | Mã đơn đúng `FS<YYMM>-` + 6 ký tự; không tuần tự; va chạm mã thì sinh lại                                                       | U            | P1  | Not assessed             |
| BR-ORD-04    | Địa chỉ thiếu tỉnh hoặc phường/xã, mã không hợp lệ bị từ chối                                                                   | A            | P0  | Not assessed             |
| BR-ORD-07    | Đặt đơn khác Tính thử ở bất kỳ điểm nào (dòng, giá, điều kiện) bị từ chối kể cả cùng tổng; Tính thử hết hạn bị từ chối          | U, A, J2     | P0  | Not assessed             |
| BR-ORD-08    | Đơn vãng lai gắn vào Tài khoản cùng email (không phân biệt hoa thường) khi email được xác thực; không gắn theo số điện thoại    | A            | P0  | Not assessed             |
| BR-ORD-09    | Tổng = 0 hoặc âm bị từ chối; không tạo Order, Payment, Giữ hàng, Hàng chờ xuất, lượt Voucher                                    | U, A         | P0  | Not assessed             |
| Idempotency  | Cùng key + cùng payload: một đơn; cùng key + khác payload: từ chối; hai request cùng key song song: một đơn                     | A, C, J1     | P0  | Not assessed             |
| Rollback     | Lỗi DB giữa Order, Dòng đơn hàng, trừ Tồn kho, lượt Voucher: không commit dở                                                    | I            | P0  | Not assessed             |
| T2           | Đặt COD hợp lệ → `PLACED`, khoản thu COD, email; vượt hạn mức COD (BR-PAY-06) bị từ chối                                        | A, J1        | P0  | Not assessed             |
| T1, T3–T5    | Online → `PENDING_PAYMENT`; IPN đúng số tiền → `PLACED`; hết 15 phút → `CANCELLED`; Người mua tự huỷ                            | U, A, J6     | P0  | Chưa build (task 29)     |
| T6–T9        | Staff xác nhận, đóng gói; huỷ từ `PLACED`/`CONFIRMED`/`PACKING` có lý do; Người mua không huỷ được từ `PACKING`                 | U, A, J5     | P0  | Chưa build (task 31, 33) |
| T10–T14      | Vận đơn tạo xong → `SHIPPING`; giao → `DELIVERED`; Hoàn hàng; 7 ngày → `COMPLETED`; T14 chỉ khi Vận đơn sự cố                   | U, A, J8     | P0  | Chưa build (task 32, 34) |
| Bảng T1–T14  | Mọi cặp trạng thái không có trong bảng bị từ chối (sinh từ bảng, không viết tay từng cặp)                                       | U            | P0  | Not assessed             |
| Mục 4.1, 4.2 | Tiền về khi đơn không còn chờ: giữ trạng thái, tự tạo Hoàn tiền; thông báo sai thứ tự, trùng, mâu thuẫn                         | U, A         | P0  | Chưa build (task 29, 32) |
| Mục 4.5      | Huỷ khi Vận đơn `creating`/`creation_unknown` bị từ chối; GHN tạo xong cho đơn đã huỷ thì tự huỷ Vận đơn                        | A            | P0  | Chưa build (task 32)     |
| US-401/402   | Người mua chỉ đọc đơn của mình; Khách vãng lai cần Mã đơn + số điện thoại; sai một trong hai trả như không tồn tại              | A, J7        | P0  | Chưa build (task 30)     |

## Thanh toán (`PAY` P0), Hoàn tiền (`REF` P0)

| Mã           | Kịch bản                                                                                                                | Tầng  | Mức | Trạng thái test      |
| ------------ | ----------------------------------------------------------------------------------------------------------------------- | ----- | --- | -------------------- |
| BR-PAY-01    | Thử lại bằng Cổng khác khi còn chờ thanh toán; đơn COD không tạo link                                                   | A, J6 | P0  | Chưa build (task 29) |
| BR-PAY-02    | Return URL không đổi trạng thái; chỉ IPN hoặc Đối soát                                                                  | A     | P0  | Chưa build (task 29) |
| Chữ ký       | IPN sai chữ ký hoặc secret khác: từ chối, không đổi gì; log không chứa secret hay dữ liệu thẻ                           | U, A  | P0  | Chưa build (task 29) |
| BR-PAY-03    | IPN lặp (cùng mã giao dịch) xử lý một lần; hai IPN song song xử lý một lần                                              | A, C  | P0  | Chưa build (task 29) |
| BR-PAY-04    | Số tiền captured khác Tổng tiền: không xác nhận, Cờ cần xử lý, tự tạo Hoàn tiền; failed/pending không tạo nghĩa vụ hoàn | U, A  | P0  | Chưa build (task 29) |
| BR-PAY-05    | Tiền về cho đơn đã huỷ hoặc đã trả: đơn giữ nguyên, tạo Hoàn tiền, email báo hoàn                                       | A     | P0  | Chưa build (task 29) |
| Timeout      | Cổng timeout khi tạo link hoặc truy vấn: không tạo Payment trùng; Đối soát xác định kết quả                             | A     | P0  | Chưa build (task 29) |
| BR-REF-01/05 | Hoàn tiền gắn đúng Thanh toán và Cổng; số tiền theo từng trường hợp (huỷ, Hoàn hàng, BR-PAY-04/05)                      | U, A  | P0  | Chưa build (task 34) |
| BR-REF-03    | Ghi nhận "Đã hoàn tiền" bắt buộc mã giao dịch hoàn                                                                      | A     | P0  | Chưa build (task 34) |
| BR-REF-04    | Huỷ COD trước giao không tạo Hoàn tiền                                                                                  | A     | P0  | Chưa build (task 34) |
| BR-REF-06    | Khoá `(payment_id, reason, return_id)`: xử lý lại không tạo thêm; tổng hoàn không vượt số đã nhận, kể cả song song      | A, C  | P0  | Chưa build (task 34) |

## Vận chuyển (`SHP` P1), Đổi trả (`RET` P1), Thông báo (`NTF` P1), Doanh thu (`REV` P1)

| Mã             | Kịch bản                                                                                                               | Tầng         | Mức | Trạng thái test      |
| -------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------ | --- | -------------------- |
| BR-SHP-01/02   | Phí theo cân nặng × số lượng; GHN lỗi hoặc timeout → phí dự phòng + Cờ cần xử lý                                       | U, A         | P1  | Chưa build (task 32) |
| BR-SHP-03      | Miễn phí ship theo Tạm tính **sau** Voucher: 499.999 / 500.000 / 500.001                                               | U            | P0  | Not assessed         |
| BR-SHP-05/06   | Bàn giao tạo Vận đơn một lần; bàn giao lại dùng lại Vận đơn; webhook và Đối soát cập nhật trạng thái                   | A            | P1  | Chưa build (task 32) |
| BR-SHP-07/08   | COD thu hộ = Tổng tiền; Vận đơn sự cố gắn Cờ cần xử lý, cho phép T14 có lý do                                          | A            | P1  | Chưa build (task 32) |
| BR-RET-01      | Yêu cầu ở đúng 7 × 24 giờ được, sau 1 giây bị từ chối (qua `Clock`)                                                    | U, A         | P1  | Chưa build (task 34) |
| BR-RET-03      | Hàng giảm trên 50% không Đổi trả được; đúng 50% được                                                                   | U            | P1  | Chưa build (task 34) |
| BR-RET-07      | Hoàn lũy kế `F(k)`; ví dụ 3 × 200.000đ, Voucher 60.000đ, trả 1 → 180.000đ; trả lần lượt 99/100/100đ; property-based    | U (mutation) | P0  | Chưa build (task 34) |
| BR-RET-08      | Chấp nhận theo dòng 0 tới số gửi trả; không dòng nào → Từ chối; hai yêu cầu song song không dùng chung mốc `k`         | A, C         | P1  | Chưa build (task 34) |
| BR-RET-07 (0đ) | Tổng hoàn 0đ: không tạo Hoàn tiền 0đ, yêu cầu không còn mở                                                             | U, A         | P1  | Chưa build (task 34) |
| Mục 4.4        | Đơn chưa `COMPLETED` khi còn Đổi trả đang mở, kể cả đã quá 7 ngày                                                      | A            | P1  | Chưa build (task 34) |
| BR-NTF-01      | Email đúng sự kiện; đơn online chưa trả không nhận email kể cả khi huỷ; job chạy lại không gửi trùng                   | A            | P1  | Chưa build (task 35) |
| BR-NTF-02/03   | Email theo ngôn ngữ đã chọn; Khách vãng lai không email thì không gửi                                                  | A            | P1  | Chưa build (task 35) |
| BR-REV-01/02   | Doanh thu theo ngày Hoàn tất giờ Việt Nam (đơn hoàn tất 23:59 và 00:00); trừ Hoàn tiền Đổi trả, không trừ BR-PAY-04/05 | U, A         | P1  | Chưa build (task 36) |

## Xác thực và phân quyền (P0)

| Mã                      | Kịch bản                                                                                             | Tầng  | Mức | Trạng thái test |
| ----------------------- | ---------------------------------------------------------------------------------------------------- | ----- | --- | --------------- |
| US-501                  | Email trùng (không phân biệt hoa thường) bị từ chối; token xác thực hết hạn hoặc dùng lại bị từ chối | A     | P0  | Not assessed    |
| US-502                  | Sai mật khẩu và rate limit; refresh rotation: refresh token cũ dùng lại thì thu hồi phiên            | A     | P0  | Not assessed    |
| US-503                  | Quên mật khẩu trả cùng response cho email có và không có Tài khoản                                   | A     | P0  | Not assessed    |
| Ma trận quyền (mục 3.2) | Mỗi hành động Admin-only gọi bằng Staff → 403; không đăng nhập → 401; sinh test từ ma trận           | A     | P0  | Not assessed    |
| Ownership               | Người mua không đọc hay sửa đơn, giỏ, địa chỉ, hồ sơ của người khác (đổi id trong URL)               | A, J7 | P0  | Not assessed    |
| Mass assignment         | Gửi thêm `role`, `status`, `price` trong body không có tác dụng                                      | A     | P0  | Not assessed    |
| Staff tự nâng quyền     | Staff không sửa được Vai trò của mình hay của người khác                                             | A     | P0  | Not assessed    |
