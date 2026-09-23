---
status: Implementing
owner: Backend
last_verified: 2026-09-23
dependencies: [02-categories.md]
supersedes:
  [
    docs/superpowers/specs/2026-09-18-products-and-variants-design.md,
    docs/superpowers/specs/2026-09-18-product-images-object-storage-design.md,
  ]
verification: [src/products, src/upload-image, test/products.e2e-spec.ts, test/upload-image.e2e-spec.ts]
---

# 03 — Products, Variants và Product Images

## Aggregate contract

Product là aggregate write boundary. `POST /products` nhận nested `variants[]` và `images[]`; `PATCH /products/:id` full-sync cả hai mảng. Không có endpoint con nào cho Variant hay Product Image — kể cả đọc: `GET /products/:id` (và list) embed sẵn `variants` và `images`. Variant không còn bán chuyển sang `DISCONTINUED`; không hard-delete khi đã có commercial reference.

Endpoint của module: `POST/GET /products`, `GET/PATCH/DELETE /products/:id`. Write yêu cầu `STORE_MANAGER` hoặc `MASTER_ADMIN`; catalog reads là public. Presign ảnh thuộc module `upload-image` (xem dưới).

## Invariants

- Product slug và Variant SKU là unique.
- Mỗi Product phải thỏa validation của nested variant payload.
- Tạo Variant đồng thời bootstrap Inventory quantity/reserved quantity bằng `0`.
- Product/category reference phải tồn tại.
- Variant đang được Cart Item/Order Item tham chiếu không hard-delete.
- Create/update Product và toàn bộ Variant mutation phải atomic trong một database transaction.

- `PATCH /products/:id` cập nhật Product fields, full-sync Variants và full-sync Images trong **một** transaction duy nhất.

## Product Images contract

Upload tách khỏi Product, API không proxy file bytes:

1. Client gọi `POST /upload-images/presign` với `purpose: PRODUCT_IMAGE` và tối đa 10 file (`image/jpeg|png|webp`, ≤ 5 MB). Server trả presigned POST target, key dạng `tmp/product-image/<uuid>.<ext>` (Pending Upload).
2. Client upload trực tiếp lên S3-compatible storage; policy của presigned POST chặn sai content-type/size.
3. Client gửi các key vào `images[]` của `POST /products` hoặc `PATCH /products/:id`.

Payload `images[]` (tối đa 10 phần tử, thứ tự mảng = thứ tự hiển thị):

- `{ key, altText? }` — gắn Pending Upload mới. Key phải có prefix `tmp/product-image/` (sai → 400). Server `HEAD` song song mọi key mới **trước** transaction: object không tồn tại → 400 liệt kê key lỗi; storage không phản hồi → 503, không ghi gì. Sau đó `CopyObject` sang `products/<productId>/<uuid>.<ext>`, lưu URL chính, xoá bản tạm best-effort (ADR 0010).
- `{ id, altText? }` — giữ ảnh đang có (không `HEAD` lại). `id` không thuộc Product → 400.
- PATCH: không gửi `images` → không đổi; ảnh đang có vắng mặt trong mảng → xoá row, xoá object best-effort sau commit; `[]` → xoá hết.

Cover Image = `images[0]`. Không có `isPrimary`, không có `sortOrder` trong request/response; cột `sort_order` chỉ là thứ tự nội bộ, response luôn sắp theo nó. Đổi Cover Image = PATCH với ảnh mong muốn ở đầu mảng.

Pending Upload không được gắn tự bị xoá bởi lifecycle rule `tmp/` → 1 ngày trên bucket (bắt buộc cấu hình ở mọi môi trường). Local/unit test dùng fake adapter; external gate dùng MinIO/S3-compatible service.

Module `upload-image` chỉ biết `purpose` → (prefix, role được phép). Hiện có một purpose `PRODUCT_IMAGE` cho `STORE_MANAGER`/`MASTER_ADMIN`; thêm loại ảnh mới = thêm giá trị enum, không đổi API.

## Acceptance criteria còn lại

- Xác minh presign/attach lifecycle với MinIO hoặc provider thật.
- OpenAPI snapshot khớp nested aggregate và image endpoints.
