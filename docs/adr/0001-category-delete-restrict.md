# Xoá Danh mục yêu cầu gán lại Sản phẩm và Danh mục con trước

Bối cảnh: Danh mục là cây nhiều cấp (`business/01-vision-scope.md` §5.1), Sản phẩm thuộc một Danh mục. Cần quyết định xoá một Danh mục còn được tham chiếu thì xử lý ra sao. Ba phương án: (A) `ON DELETE CASCADE` — xoá luôn Sản phẩm/Danh mục con, phá huỷ Sản phẩm đã có trong đơn (trái BR-CAT-09); (B) `SET NULL` — sinh ra Sản phẩm "chưa phân loại" hoặc Danh mục con mồ côi mà mọi màn hình phải xử lý; (C) FK `RESTRICT` ở DB, service kiểm tra trước và trả `409` kèm số Sản phẩm và số Danh mục con còn tham chiếu.

Quyết định: **(C)**, áp dụng cho cả `products.category_id` và `categories.parent_id`.

Hệ quả: xoá Danh mục còn Sản phẩm hoặc Danh mục con luôn thất bại cho tới khi Admin chuyển chúng sang Danh mục khác. MVP không có xoá hàng loạt/cascade cho Danh mục.
