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
verification:
  [
    src/modules/products,
    src/modules/option-values,
    src/modules/upload-image,
    test/products.e2e-spec.ts,
    test/option-values.e2e-spec.ts,
    test/upload-image.e2e-spec.ts,
  ]
---

# 03 — Products, Variants và Product Images

## Aggregate contract

Product là aggregate write boundary. `POST /products` nhận nested `variants[]` và `images[]`; `PATCH /products/:id` full-sync cả hai mảng. Không có endpoint con nào cho Variant hay Product Image — kể cả đọc: `GET /products/:id` (và list) embed sẵn `variants` và `images`. Variant bị bỏ khỏi `variants[]` luôn chuyển sang `DISCONTINUED` (kể cả chưa từng bán), không bao giờ hard-delete qua PATCH. `DELETE /products/:id` xoá cả product (variant cascade, object ảnh dọn best-effort sau commit); product có variant đã vào Cart/Order thì FK RESTRICT chặn → 409.

Endpoint của module: `POST/GET /products`, `GET/PATCH/DELETE /products/:id`. Write yêu cầu `STORE_MANAGER` hoặc `MASTER_ADMIN`; catalog reads là public. Option Value thuộc module `option-values`, presign ảnh thuộc module `upload-image` (xem dưới).

## Invariants

- Product slug, Product Code và Variant SKU là unique. Product Code không đổi sau khi tạo.
- Mỗi Product có ≥ 1 variant `ACTIVE`, tối đa 50 variant không `DISCONTINUED`, và 1–5 ảnh.
- Mỗi Product phải thỏa validation của nested variant payload.
- Tạo Variant đồng thời bootstrap Inventory quantity/reserved quantity bằng `0`.
- Product/category reference phải tồn tại.
- Variant đang được Cart Item/Order Item tham chiếu không hard-delete (FK RESTRICT).
- Create/update Product và toàn bộ Variant mutation phải atomic trong một database transaction.

- `PATCH /products/:id` cập nhật Product fields, full-sync Variants và full-sync Images trong **một** transaction duy nhất.

## Product Images contract

Upload tách khỏi Product, API không proxy file bytes:

1. Client gọi `POST /upload-images/presign` với `purpose: PRODUCT_IMAGE` và tối đa 5 file (`image/jpeg|png|webp`, ≤ 5 MB). Server trả presigned POST target, key dạng `tmp/product-image/<uuid>.<ext>` (Pending Upload).
2. Client upload trực tiếp lên S3-compatible storage; policy của presigned POST chặn sai content-type/size.
3. Client gửi các key vào `images[]` của `POST /products` hoặc `PATCH /products/:id`.

Payload `images[]` (1–5 phần tử, bắt buộc khi tạo, thứ tự mảng = thứ tự hiển thị):

- `{ key, altText? }` — gắn Pending Upload mới. Key phải có prefix `tmp/product-image/` (sai → 400). Server `HEAD` song song mọi key mới **trước** transaction: object không tồn tại → 400 liệt kê key lỗi; storage không phản hồi → 503, không ghi gì. Sau đó `CopyObject` sang `products/<productId>/<uuid>.<ext>`, lưu URL chính, xoá bản tạm best-effort (ADR 0010).
- `{ id, altText? }` — giữ ảnh đang có (không `HEAD` lại). `id` không thuộc Product → 400.
- PATCH: không gửi `images` → không đổi; ảnh đang có vắng mặt trong mảng → xoá row, xoá object best-effort sau commit; `[]` hoặc > 5 → 400.
- Thay ảnh = bỏ `{ id }` cũ và đặt `{ key }` mới vào đúng vị trí; ảnh mới có `id` mới. Không có entry `{ id, key }`.
- Một Pending Upload gửi vào nhiều Product không bị chặn — mỗi Product nhận một bản copy riêng. Ảnh chỉ thuộc Product, không gắn theo màu.

Cover Image = `images[0]`. Không có `isPrimary`, không có `sortOrder` trong request/response; cột `sort_order` chỉ là thứ tự nội bộ, response luôn sắp theo nó. Đổi Cover Image = PATCH với ảnh mong muốn ở đầu mảng.

Pending Upload không được gắn tự bị xoá bởi lifecycle rule `tmp/` → 1 ngày trên bucket (bắt buộc cấu hình ở mọi môi trường). Local/unit test dùng fake adapter; external gate dùng MinIO/S3-compatible service.

Key do server sinh: `<prefix><uuid>.<ext>`, `ext` suy từ `contentType` — `filename` client gửi chỉ mang tính thông tin, không bao giờ vào key. Khi gắn ảnh, key phải đúng prefix của purpose và đúng format này, sai → 400. URL presign và URL ảnh lưu DB dùng `S3_PUBLIC_ENDPOINT` (fallback `S3_ENDPOINT`) — cần khi backend gọi storage qua hostname nội bộ.

Module `upload-image` chỉ biết `purpose` → (prefix, role được phép, số file tối đa). Hiện có một purpose `PRODUCT_IMAGE` cho `STORE_MANAGER`/`MASTER_ADMIN`, tối đa 5 file; thêm loại ảnh mới = thêm giá trị enum, không đổi API.

## Dữ liệu hiện có

Chưa có dữ liệu production. Migration của ADR 0011 backfill dữ liệu dev: product cũ nhận `code` từ `id`, variant cũ giữ `sku` nhưng mất `color`/`size` text; `npm run db:seed` sửa lại các variant seed cũ thay vì tạo bản trùng.

## Concurrency

`PATCH /products/:id` là last-write-wins, không có optimistic version (ADR 0012): hai staff cùng edit một Product thì danh sách của người lưu sau thay thế toàn bộ — ảnh/variant người trước vừa thêm bị gỡ mà không báo lỗi. Riêng race giữa lúc đọc và lúc ghi trong cùng một request (ảnh đang giữ vừa bị request khác xoá) → 409.

## Option Values, variants và SKU (ADR 0011)

Option Value (`src/modules/option-values`) — danh sách màu/size chọn sẵn:

| Endpoint                    | Quyền  | Ghi chú                                                                                                                                                                                                                 |
| --------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /option-values`       | Staff  | `{ type: COLOR\|SIZE, name, code, position? }`. `code` `^[A-Z0-9]{1,10}$`, duy nhất trên cả màu lẫn size (trùng → 409) — nếu không, "màu X" và "size X" ghép ra cùng SKU. Thiếu `position` → cuối danh sách của loại đó |
| `GET /option-values?type=`  | Public | Chỉ giá trị không ẩn, sắp theo `position`. `includeHidden=true` chỉ cho staff (401/403)                                                                                                                                 |
| `PATCH /option-values/:id`  | Staff  | `{ name?, position?, hidden? }`. Gửi `code`/`type` → 400                                                                                                                                                                |
| `DELETE /option-values/:id` | Staff  | 204 nếu chưa variant nào dùng; đang dùng → 409, dùng `hidden: true` thay thế                                                                                                                                            |

Variant trong `variants[]`:

- Tạo mới: `{ colorId?, sizeId?, price }` — thiếu `price` → 400 — Option Value phải tồn tại, không ẩn, đúng loại (400). Không có `sku`/`color`/`size` tự do (400).
- Giữ lại: `{ id, price?, status? }`. Gửi `colorId`/`sizeId` kèm `id` → 400 — chọn nhầm thì bỏ variant đó và tạo variant mới.
- SKU = `<Product Code>-<mã màu>-<mã size>`, bỏ đoạn không có; product không có biến thể có SKU = Product Code. Trùng SKU trong product (kể cả với variant đã `DISCONTINUED` — tổ hợp đã discontinue không tạo lại được, dùng `INACTIVE` nếu định bán lại) → 409, kiểm trước mọi ghi.
- `description` (không bắt buộc, tối đa 5000 ký tự) nhận ở `POST` và `PATCH`; `PATCH` gửi `null` để xoá.
- `POST /products` bắt buộc `code` (`^[A-Z0-9]{2,20}$`, trùng → 409) và ≥ 1 variant. `PATCH` gửi `code` → 400.
- Sau mỗi ghi phải còn ≥ 1 variant `ACTIVE` (400) — ngừng bán cả Product dùng `status` của Product. Tối đa 50 variant `ACTIVE` + `INACTIVE` (400).
- Variant vắng mặt trong `variants[]` luôn thành `DISCONTINUED`, kể cả chưa từng bán; `DISCONTINUED` không quay lại `ACTIVE`/`INACTIVE` (400).
- Response variant nhúng `color`/`size` dạng `{ id, name, code }` hoặc `null`.

## Reads

`GET /products` và `GET /products/:id` public chỉ trả variant `ACTIVE`. `includeAllVariants=true` trả mọi variant, chỉ cho `STORE_MANAGER`/`MASTER_ADMIN` (thiếu token → 401, sai role → 403 — không âm thầm bỏ cờ). Form edit bắt buộc dùng cờ này, vì PATCH full-sync với danh sách thiếu sẽ discontinue các variant bị bỏ sót. Response của `POST`/`PATCH` luôn chứa mọi variant.

## Error cases

Mọi lỗi backend có shape `{ statusCode, message, requestId }`. Mọi case dưới đây đã implement và có test e2e.

**Presign và upload** (trước khi gọi Products API)

| #   | Case                                                              | Status               | Trạng thái |
| --- | ----------------------------------------------------------------- | -------------------- | ---------- |
| U1  | Thiếu/sai token; role không được phép cho `purpose`               | 401 / 403            | ✅         |
| U2  | `files` rỗng, sai `contentType`, sai `purpose`                    | 400                  | ✅         |
| U3  | Quá 5 file `PRODUCT_IMAGE` mỗi request                            | 400                  | ✅         |
| U4  | Upload lên storage > 5 MB (storage chặn)                          | 400 `EntityTooLarge` | ✅         |
| U5  | Upload sai `Content-Type` hoặc presign quá 15 phút (storage chặn) | 403 `AccessDenied`   | ✅         |

**`PATCH /products/:id`**

| #   | Case                                                                          | Status    | Trạng thái |
| --- | ----------------------------------------------------------------------------- | --------- | ---------- |
| P1  | Thiếu/sai token; role không phải `STORE_MANAGER`/`MASTER_ADMIN`               | 401 / 403 | ✅         |
| P2  | Product không tồn tại                                                         | 404       | ✅         |
| P3  | Field sai định dạng                                                           | 400       | ✅         |
| P4  | `categoryId` không tồn tại                                                    | 404       | ✅         |
| P5  | Tên trùng product khác (slug)                                                 | 409       | ✅         |
| P6  | Tên không sinh được slug                                                      | 400       | ✅         |
| P7  | Cố đổi Product Code                                                           | 400       | ✅         |
| P8  | Danh sách ảnh cuối rỗng hoặc > 5                                              | 400       | ✅         |
| P9  | Entry ảnh có cả/không có `id` và `key`                                        | 400       | ✅         |
| P10 | Trùng `id` hoặc `key` trong `images[]`                                        | 400       | ✅         |
| P11 | `id` ảnh không thuộc product                                                  | 400       | ✅         |
| P12 | `key` sai prefix/format                                                       | 400       | ✅         |
| P13 | `key` không có trên storage (chưa upload, quá 1 ngày, bản tạm đã dọn)         | 400       | ✅         |
| P14 | Storage không phản hồi khi HEAD/copy                                          | 503       | ✅         |
| P15 | Ảnh đang giữ vừa bị request khác xoá giữa lúc đọc và ghi                      | 409       | ✅         |
| P16 | `id` variant không thuộc product                                              | 400       | ✅         |
| P17 | Variant mới thiếu giá, hoặc chọn Option Value sai (không tồn tại/ẩn/sai loại) | 400       | ✅         |
| P18 | Option Value không tồn tại / đang ẩn / sai loại                               | 400       | ✅         |
| P19 | Hai variant cùng tổ hợp màu + size (trùng SKU)                                | 409       | ✅         |
| P20 | Cố đổi Option Value của variant đã có                                         | 400       | ✅         |
| P21 | Không còn variant `ACTIVE` nào                                                | 400       | ✅         |
| P22 | Quá 50 variant `ACTIVE` + `INACTIVE`                                          | 400       | ✅         |
| P23 | Đưa variant `DISCONTINUED` về `ACTIVE`/`INACTIVE`                             | 400       | ✅         |

**`POST /products`**: như `PATCH` (trừ P2, P7, P11, P15, P16, P20, P23), thêm:

| #   | Case                   | Status | Trạng thái |
| --- | ---------------------- | ------ | ---------- |
| C1  | Thiếu `images` (< 1)   | 400    | ✅         |
| C2  | Thiếu `variants` (< 1) | 400    | ✅         |
| C3  | Product Code trùng     | 409    | ✅         |

**Option Values** (`/option-values`)

| #   | Case                                                                                             | Status    |
| --- | ------------------------------------------------------------------------------------------------ | --------- |
| O1  | Thiếu/sai token; role không phải `STORE_MANAGER`/`MASTER_ADMIN` (ghi, hoặc `includeHidden=true`) | 401 / 403 |
| O2  | `code` sai format (không phải `^[A-Z0-9]{1,10}$`, kể cả chữ thường) hoặc `type` sai              | 400       |
| O3  | `code` đã được Option Value khác dùng (màu hoặc size)                                            | 409       |
| O4  | PATCH gửi `code` hoặc `type`                                                                     | 400       |
| O5  | DELETE giá trị đang được variant dùng                                                            | 409       |
| O6  | PATCH/DELETE id không tồn tại                                                                    | 404       |

Hành vi khi hai staff cùng edit (mất dữ liệu âm thầm, chấp nhận): xem mục Concurrency / ADR 0012.

## Tài liệu liên quan

- Tích hợp phía FE: [Tạo/sửa Product — FE integration](../guides/product-form-fe-integration.md).
- Triển khai object storage (lifecycle, CORS, public read, hạn chế adapter): [Object storage deployment](../guides/object-storage-deployment.md).

## Acceptance criteria còn lại

- Tự động hoá kiểm tra presign/attach lifecycle với MinIO thật (đã smoke-test tay 2026-09-24: upload hợp lệ 204, >5MB 400 `EntityTooLarge`, sai Content-Type 403, HEAD/copy/public GET/delete đúng — chưa có test chạy trong CI).
- OpenAPI snapshot khớp nested aggregate (`variants[]`/`images[]`) và module `option-values`.
