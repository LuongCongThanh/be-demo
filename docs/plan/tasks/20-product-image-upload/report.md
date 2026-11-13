# Report 20

- **PR:** #87
- **Ngày merge:**

## Đã làm

- `infrastructure/storage/cloudinary.client.ts` + `storage.module.ts`: ký tham số upload (SHA-1, khớp ví dụ trong tài liệu Cloudinary), `findImage` (Admin API), `destroy`, `publicUrl`. `fetch` với timeout 10s; mọi lỗi kho → 503 và log. Thiếu `CLOUDINARY_*` → 503, `url` null.
- `POST /admin/products/:id/images/presign`; `POST /admin/products/:id/images` kiểm key đúng dạng `products/{productId}/{uuid}`, file tồn tại, định dạng JPEG/PNG/WebP, ≤ 5 MB (sai thì xoá file, 422); `DELETE` xoá file best-effort.
- `ImageResponseDto.url`, `ProductListItemResponseDto.imageUrl`; Swagger 422/503.
- `docs/architecture/06-integrations.md` §5 viết lại theo Cloudinary.

## Lệch so với spec và rủi ro còn lại

- Cloudinary nhận chữ ký trong 1 giờ, không rút xuống 5 phút; `overwrite=false` chặn ghi đè ảnh đã kiểm (đã thử: upload lại bằng cùng chữ ký trả về file cũ, dung lượng không đổi).
- Review (`/code-review`) tìm ra key `products/{id}/../{idKhác}/…` lọt qua kiểm `startsWith` và trỏ sang file của Sản phẩm khác; đã sửa bằng so khớp chặt `products/{productId}/{uuid}`.
- File đã upload nhưng không gắn (bỏ ngang, hoặc ghi DB lỗi sau khi kiểm) nằm lại trong kho; chưa có job dọn. Không xoá ngay khi ghi DB lỗi để người dùng thử lại được với cùng key.
- Sau khi xoá, CDN có thể còn trả ảnh vài giây (đã kiểm: Admin API 404 ngay, URL CDN 404 sau ~20s).

## Test cũ đã chạm

| File                                                                 | Thay đổi                                                                             |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `admin-product-image.service.spec.ts`                                | Stub adapter kho ảnh; `storageKey` fixture đúng dạng; stub `findFirst` cho `remove`. |
| `admin-product.service.spec.ts`                                      | Thêm provider stub `CloudinaryClient`.                                               |
| `admin-product-lifecycle.service.spec.ts`, `product.service.spec.ts` | Truyền stub adapter vào constructor.                                                 |

| `test/support/create-test-app.ts` | Stub `CloudinaryClient` (mọi key coi như đã upload JPEG 1 KB) để e2e không gọi kho ảnh thật. |
| `test/products.e2e-spec.ts` | `storageKey` fixture đổi sang dạng `products/{productId}/{uuid}`; assertion giữ nguyên. |

Không có test mới.

## Kiểm tra

- `npm run typecheck`, `npm run lint` (chỉ còn warning cũ `no-explicit-any`), `npm run test` (238 pass), `npm run test:e2e` (175 pass), `npm run build`, `npm run openapi:write` pass.

## Acceptance criteria: chạy tay

Không cấu hình (`CLOUDINARY_*` trống): presign và gắn ảnh → 503; body `image/gif` hoặc `size` > 5 MB → 400; `imageUrl` null. Key sai dạng: `products/<id>/../<idKhác>/<uuid>`, `products/<id>/x`, `products/<id>//<uuid>` → 400.

Với tài khoản Cloudinary thật, Postgres/Redis docker throwaway, API `node dist/main.js`; form POST gửi y như CMS sẽ gửi (`fields` + `file`):

```
== 1. presign PNG        → uploadUrl https://api.cloudinary.com/v1_1/<cloud>/image/upload, fields [allowed_formats, overwrite, public_id, timestamp, api_key, signature]
== 2. upload PNG         → 200 {"format":"png","bytes":124977}
== 3. reuse signature to upload a 6.7 MB file (overwrite=false) → 200, file cũ giữ nguyên (bytes 124977)
== 4. attach             → 201
== 5. image url serves   → 200 image/png 124977B
== 6. storefront         → GET /products imageUrl = https://res.cloudinary.com/<cloud>/image/upload/products/<id>/<uuid>; GET /products/:id images[].url giống vậy
== 7. attach a key never uploaded → 422 "Image was not uploaded to storage"
== 8. GIF upload         → Cloudinary 400 "Image file format gif not allowed"; attach → 422
== 9. 6.7 MB PNG (client khai 1000 bytes) → Cloudinary 200; attach → 422 "Image is larger than 5242880 bytes"; attach lại → 422 "not uploaded" (file đã bị xoá)
== 10. DELETE image      → 204; Admin API resource → 404; URL CDN → 404 sau ~20s
```
