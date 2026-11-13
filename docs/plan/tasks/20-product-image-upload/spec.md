---
status: in-progress
pr: #87
blocked-by: [19-catalog-search-sort]
labels: [ready-for-agent]
---

# Spec 20: Upload ảnh Sản phẩm lên Cloudinary và URL ảnh

Branch: `feature/product-image-upload` · Slice B1 (Catalog). Không viết test mới (Phase 7); xác minh bằng typecheck, lint, build, Swagger và chạy tay. Test cũ chỉ sửa cơ chế (constructor, fixture).

## Problem Statement

`POST /admin/products/:id/images` nhận một `storageKey` nhưng không có cách nào đưa file lên kho, API không kiểm file có thật không, và response không có URL nên CMS lẫn storefront không hiện được ảnh. CMS đang gọi `/media/presign` và `/media/:id/complete`, API không có.

## Solution

- Adapter `infrastructure/storage/cloudinary.client.ts` (một adapter, inject trực tiếp): ký tham số upload, hỏi thông tin file, xoá file, dựng URL công khai. Ký bằng SHA-1 theo tài liệu Cloudinary, gọi API bằng `fetch`, không thêm dependency.
- `POST /admin/products/:id/images/presign` (`CATALOG_PRODUCT_MANAGE`): body `{ contentType: image/jpeg|png|webp, size ≤ 5 MB }` → `{ uploadUrl, fields, storageKey, expiresAt }`. `storageKey = products/{productId}/{uuid}`. Chữ ký kèm `allowed_formats=jpg,png,webp`, `overwrite=false`.
- `POST /admin/products/:id/images`: `storageKey` phải đúng tiền tố của Sản phẩm (400); file phải có trong kho (422), đúng định dạng và ≤ 5 MB (sai thì xoá file, 422).
- `DELETE /admin/products/:id/images/:imageId`: xoá bản ghi, rồi xoá file best-effort.
- Ảnh trong mọi response có `url`; dòng danh sách storefront có `imageUrl` (ảnh primary trước, rồi theo `sortOrder`).
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` optional: thiếu thì upload/gắn ảnh 503, `url` null.
- `docs/architecture/06-integrations.md` §5 viết lại theo Cloudinary; ghi cách đổi sang kho chuẩn S3.
- Sau khi merge: tag `openapi-v0.3.0`.

## Acceptance criteria

- Không cấu hình: presign và gắn ảnh trả 503; `url`, `imageUrl` null.
- Body presign sai loại hoặc > 5 MB → 400; `storageKey` của Sản phẩm khác → 400.
- Với tài khoản Cloudinary thật: presign → form POST lên `uploadUrl` thành công → gắn ảnh 201 có `url` mở được; storefront `GET /products` có `imageUrl`, `GET /products/:id` có `images[].url`; gắn key chưa upload → 422; upload GIF bị Cloudinary từ chối; xoá ảnh → file biến mất khỏi Cloudinary.
