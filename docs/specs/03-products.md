---
status: Implementing
owner: Backend
last_verified: 2026-09-24
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

Key do server sinh: `<prefix><uuid>.<ext>`, `ext` suy từ `contentType` — `filename` client gửi chỉ mang tính thông tin, không bao giờ vào key. Khi gắn ảnh, key phải đúng prefix của purpose và đúng format này, sai → 400. URL presign và URL ảnh lưu DB dùng `S3_PUBLIC_ENDPOINT` (fallback `S3_ENDPOINT`) — cần khi backend gọi storage qua hostname nội bộ.

Module `upload-image` chỉ biết `purpose` → (prefix, role được phép). Hiện có một purpose `PRODUCT_IMAGE` cho `STORE_MANAGER`/`MASTER_ADMIN`; thêm loại ảnh mới = thêm giá trị enum, không đổi API.

## Concurrency

`PATCH /products/:id` là last-write-wins, không có optimistic version (ADR 0012): hai staff cùng edit một Product thì danh sách của người lưu sau thay thế toàn bộ — ảnh/variant người trước vừa thêm bị gỡ mà không báo lỗi. Riêng race giữa lúc đọc và lúc ghi trong cùng một request (ảnh đang giữ vừa bị request khác xoá) → 409.

## Đã chốt, chưa implement (2026-09-24)

Các mục dưới đây thay thế phần tương ứng ở trên khi được implement; đến lúc đó phần trên vẫn mô tả đúng code hiện tại.

### Images

- Mỗi Product có **1–5** Product Image (thay cho 0–10). `POST /products` bắt buộc `images` ≥ 1; PATCH với danh sách cuối rỗng hoặc > 5 → 400. Không gửi `images` → không đổi.
- Presign `PRODUCT_IMAGE` tối đa **5** file mỗi request — giới hạn theo purpose, không còn một cap chung.
- Thay ảnh = bỏ `{ id }` cũ và đặt `{ key }` mới vào đúng vị trí; ảnh mới có `id` mới. Không có entry `{ id, key }`.
- Một Pending Upload gửi vào nhiều Product không bị chặn — mỗi Product nhận một bản copy riêng.
- Ảnh vẫn chỉ thuộc Product, không gắn theo màu.

### Variants, Option Value, SKU (ADR 0011)

- `STORE_MANAGER`/`MASTER_ADMIN` quản lý danh sách Option Value cho đúng hai loại: màu và size. Mỗi giá trị có tên hiển thị (sửa được) và mã (không đổi). Option Value đang được variant dùng không xoá được (409), chỉ ẩn khỏi danh sách chọn.
- Product có **Product Code** do staff nhập khi tạo: duy nhất (trùng → 409), không đổi sau khi tạo.
- Variant mới chọn Option Value (không gõ `color`/`size`/`sku`); SKU = `<Product Code>-<mã màu>-<mã size>`, bỏ đoạn không có. Option Value không tồn tại / đang ẩn / sai loại → 400; trùng tổ hợp trong cùng Product → 409.
- Option Value của variant đã tạo không đổi được (400); chọn nhầm = bỏ variant đó rồi tạo variant mới.
- `POST /products` bắt buộc ≥ 1 variant. Sau PATCH phải còn ≥ 1 variant `ACTIVE` (400) — ngừng bán cả Product dùng `status` của Product.
- Tối đa **50** variant `ACTIVE` + `INACTIVE` mỗi Product (400); `DISCONTINUED` không tính.
- Variant vắng mặt trong `variants[]` luôn thành `DISCONTINUED`, kể cả chưa từng bán; `DISCONTINUED` không quay lại `ACTIVE`/`INACTIVE` (400).

### Reads

- `GET /products` / `GET /products/:id` public chỉ trả variant `ACTIVE`. Staff gửi query riêng (dự kiến `?includeAllVariants=true`) để thấy đủ — form edit bắt buộc dùng chế độ này, vì PATCH full-sync với danh sách thiếu sẽ discontinue các variant bị bỏ sót.

## Acceptance criteria còn lại

- Tự động hoá kiểm tra presign/attach lifecycle với MinIO thật (đã smoke-test tay 2026-09-24: upload hợp lệ 204, >5MB 400 `EntityTooLarge`, sai Content-Type 403, HEAD/copy/public GET/delete đúng — chưa có test chạy trong CI).
- OpenAPI snapshot khớp nested aggregate và image endpoints.
