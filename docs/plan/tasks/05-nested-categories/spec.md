---
status: done
pr: #60
blocked-by: [04-sizes-colors-variants]
---

# Spec 05: Danh mục nhiều cấp

Branch: `feature/nested-categories` · Plan tổng: [PR 5](../../realign-identity-catalog.md)

## Problem Statement

Danh mục hiện chỉ có một cấp, nên Admin không tổ chức được catalog kiểu "Nam > Áo > Áo thun" như mô tả trong `architecture/02-modules`. Cũng chưa có cách sắp thứ tự hay ẩn danh mục. ADR 0001 yêu cầu chặn xoá danh mục còn phụ thuộc, nhưng điều này chưa được đảm bảo cho quan hệ cha-con.

## Solution

- Danh mục có thể có danh mục cha, kèm thứ tự hiển thị và cờ hiển thị.
- Hệ thống chặn tạo vòng lặp và chặn xoá danh mục còn con hoặc còn sản phẩm.
- Storefront nhận về một cây danh mục đã sắp xếp, chỉ gồm các danh mục đang hiển thị.

## User Stories

1. As an Admin, I want to create a category under a parent, so that I can build a multi-level catalog.
2. As an Admin, I want to create a root category (no parent), so that I can start new trees.
3. As an Admin, I want to move a category to another parent, so that I can reorganise the catalog.
4. As an Admin, I want to move a category to root, so that I can promote it.
5. As an Admin, I want moving a category under itself or its descendant to be rejected, so that the tree never forms a cycle.
6. As an Admin, I want a non-existent parent to be rejected, so that categories never point to nothing.
7. As an Admin, I want to set `sort_order` on a category, so that siblings appear in my chosen order.
8. As an Admin, I want to hide a category (`is_visible = false`), so that I can prepare it without customers seeing it.
9. As an Admin, I want deleting a category with children to return 409, so that I don't orphan subcategories (ADR 0001).
10. As an Admin, I want deleting a category with products to return 409, so that products are never left without a category (ADR 0001).
11. As an Admin, I want deleting an empty leaf category to succeed, so that I can clean up mistakes.
12. As an Admin/Staff, I want back-office category listing to include hidden categories with their parent, so that I can manage the full tree.
13. As a Staff, I want to receive 403 on category writes, so that catalog writes stay Admin-only.
14. As a Customer, I want `GET /categories` to return a nested tree, so that the storefront can render a menu.
15. As a Customer, I want siblings ordered by `sort_order` then name, so that the menu order is stable.
16. As a Customer, I want hidden categories and their whole subtree excluded, so that hiding a parent hides its children too.
17. As an operator, I want existing categories migrated as roots with default order and visible, so that the current storefront doesn't change.

## Implementation Decisions

- **Schema:** `categories.parent_id` nullable, FK tự tham chiếu `ON DELETE RESTRICT` + index. Thêm `sort_order int default 0` và `is_visible bool default true`.
- **Migration:** SQL tay. Dữ liệu cũ thành root, giữ `sort_order = 0` và `is_visible = true`.
- **Chặn vòng lặp:** kiểm tra ở service khi tạo/sửa `parentId`: đi ngược chuỗi tổ tiên của parent mới, nếu gặp chính danh mục đang sửa → 400. Parent không tồn tại → 404 (thống nhất một mã trong DTO/docs).
- **Xoá:** còn con → 409, còn sản phẩm (bất kể trạng thái) → 409. Service kiểm tra trước, FK RESTRICT là lưới an toàn. DB violation được `AllExceptionsFilter` map sang 409.
- **Routes:**
  - Storefront `GET /api/v1/categories` công khai, trả cây lồng nhau `{ id, name, slug?, children: [] }`. Chỉ gồm `is_visible`, và cha bị ẩn thì cả nhánh bị loại. Sắp xếp theo `sort_order`, rồi theo tên.
  - Back-office `GET /api/v1/admin/categories` trả danh sách phẳng có `parentId`, `isVisible`, `sortOrder` cho `STAFF`, `ADMIN`.
  - Route ghi dùng `/admin/categories…`, chỉ `@Roles('ADMIN')`.
- **Dựng cây:** đọc mọi danh mục trong một query rồi dựng cây trong bộ nhớ (danh mục ít), tránh N+1.
- Không giới hạn cứng độ sâu ở DB. Nếu business cần giới hạn thì thêm ở service sau.

## Testing Decisions

- Test qua HTTP: tạo cây danh mục qua API rồi assert shape và thứ tự của cây storefront, cùng các mã lỗi. Không test hàm dựng cây hay hàm kiểm tra vòng lặp riêng lẻ.
- Seam duy nhất: **e2e HTTP**, cập nhật `categories.e2e-spec.ts`.
- Ca chính:
  - Vòng lặp A → B → A và tự làm cha của chính mình → 400.
  - Parent không tồn tại → 404.
  - Xoá danh mục còn con hoặc còn sản phẩm → 409. Xoá lá rỗng → 2xx.
  - Cây trả đúng thứ tự. Ẩn cha → cả nhánh biến mất.
  - Staff ghi → 403.
- Prior art: `test/categories.e2e-spec.ts`.

## Out of Scope

Breadcrumb và lọc sản phẩm theo cả nhánh danh mục (có thể làm sau). Kéo-thả sắp xếp hàng loạt. Đa ngôn ngữ tên danh mục (BR-CAT-10). Giới hạn độ sâu.

## Further Notes

Tham chiếu: ADR 0001 · `architecture/02-modules` · `11-database` §4.2. Sau task này, cập nhật `architecture/modules/identity.md` và `catalog.md` từ "Nháp" sang "Đã chốt cho MVP" (xem plan tổng).

## Acceptance criteria

- AC1: Vòng lặp bị chặn (400). Parent không tồn tại → 404.
- AC2: Xoá danh mục còn con hoặc còn sản phẩm → 409.
- AC3: `GET /categories` trả cây đúng thứ tự, chỉ gồm danh mục hiển thị.
- AC4: lint, typecheck, test, test:e2e xanh.
