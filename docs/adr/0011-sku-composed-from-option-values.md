---
decision_status: accepted
implementation_status: implemented
decided_at: 2026-09-24
last_verified: 2026-09-24
related_spec: ../specs/03-products.md
---

# SKU do hệ thống ghép từ Product Code + Option Value, staff không gõ tay

Hiện `sku`, `color`, `size` của Product Variant là text tự do do staff nhập. Hệ quả: cùng một màu tồn tại dưới nhiều cách viết ("Đen", "đen", "Black"), SKU trùng hoặc không theo quy ước, và storefront không lọc được theo thuộc tính chuẩn. Chọn: `STORE_MANAGER`/`MASTER_ADMIN` quản lý tập trung danh sách **Option Value** cho đúng hai loại thuộc tính — màu và size — mỗi giá trị có tên hiển thị và mã ngắn; khi tạo variant staff chỉ **chọn** Option Value, còn SKU do hệ thống ghép `<Product Code>-<mã màu>-<mã size>` (bỏ đoạn thuộc tính không có; product không có biến thể có SKU = Product Code). Product Code do staff đặt khi tạo Product, duy nhất.

## Considered Options

- **Staff tự nhập SKU, FE chỉ gợi ý** (hiện trạng): linh hoạt nhất, nhưng không giải quyết được thuộc tính trùng/lệch cách viết.
- **Admin tạo sẵn mã SKU hoàn chỉnh rồi staff chọn khi tạo product**: sinh ra SKU chưa thuộc Product nào — trái với định nghĩa SKU là mã của một Product Variant — kéo theo câu hỏi gán nhầm, gán hai lần, dọn SKU không dùng.
- **Hệ thống sinh SKU từ tên product/màu/size dạng chữ**: tên đổi thì SKU lệch nghĩa hoặc phải đổi theo (hỏng nhãn đã in), tiếng Việt phải bỏ dấu, dễ trùng.
- **Loại thuộc tính tự định nghĩa được** (thêm "Chất liệu", "Dung lượng"…): linh hoạt nhưng SKU có số đoạn thay đổi, phải thêm khái niệm Option phía trên Option Value. Hoãn vì store hiện chỉ bán thời trang.

## Consequences

- SKU chỉ ổn định khi mọi thành phần của nó bất biến, nên: Product Code không đổi sau khi tạo; **mã** của Option Value không đổi (tên hiển thị vẫn sửa được); Option Value của một variant không đổi sau khi tạo — chọn nhầm thì bỏ variant đó (thành Discontinued Variant) và tạo variant mới. Option Value đang được dùng chỉ ẩn khỏi danh sách chọn, không xoá được (cùng tinh thần ADR 0001).
- Hai variant cùng tổ hợp màu + size trong một Product là trùng SKU → 409.
- Order Item đã chụp `sku` tại thời điểm đặt hàng, nên dữ liệu đơn cũ không phụ thuộc vào Option Value về sau.
- Chuyển sang loại thuộc tính tự định nghĩa sau này đòi hỏi đổi format SKU và migrate variant đang có — đây là lý do quyết định được ghi lại.
- Migration từ cột `color`/`size` text tự do: chưa có dữ liệu production, không cần chuyển đổi dữ liệu cũ.
