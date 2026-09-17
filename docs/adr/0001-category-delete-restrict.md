# Xóa Category yêu cầu gán lại sản phẩm trước

Bối cảnh: MVP của `categories` cần một endpoint xóa, nhưng `products.category_id → categories.id` chưa định nghĩa hành vi cascade cho trường hợp này. Có ba phương án được cân nhắc: (A) `ON DELETE CASCADE` — xóa luôn các sản phẩm thuộc category đó, rủi ro là phá hủy những sản phẩm mà variant của chúng đã từng bán trong một Order; (B) `ON DELETE SET NULL` — cho phép `category_id` nullable và tạo ra trạng thái sản phẩm "chưa phân loại" mà mọi màn hình liệt kê/lọc đều phải xử lý; (C) giữ FK ở mức DB là `RESTRICT` và để `CategoriesService.remove()` kiểm tra sản phẩm còn tồn tại trước, trả về 409 kèm số lượng thay vì để một lỗi FK violation thô lộ ra ngoài.

Quyết định: **(C)**. Cách này tái sử dụng đúng hành vi FK đã ngụ ý trong tài liệu tóm tắt DB (`orders.user_id` cũng là `RESTRICT` vì cùng lý do "không phá hủy dữ liệu đang được tham chiếu"), tránh phải phát minh thêm khái niệm sản phẩm "chưa phân loại", và cho admin một thông báo lỗi rõ ràng, có thể hành động được thay vì một lỗi 500.

Hệ quả: xóa một category còn sản phẩm sẽ luôn thất bại cho tới khi admin gán lại các sản phẩm đó sang category khác trước — MVP này không có đường xóa hàng loạt/cascade cho category.
