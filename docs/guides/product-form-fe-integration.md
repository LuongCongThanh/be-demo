# Tạo/sửa Product — hướng dẫn tích hợp phía FE

Dành cho FE làm màn hình tạo/sửa Product. Contract nghiệp vụ và danh sách lỗi đầy đủ: [spec 03 — Products](../specs/03-products.md).

## Tóm tắt

File ảnh **không đi qua backend**. FE làm 3 bước:

1. Xin presign từ backend → nhận `{ key, uploadUrl, fields }` cho mỗi file.
2. Upload file thẳng lên storage (MinIO local / S3 production) bằng `uploadUrl` + `fields`.
3. Gửi các `key` vào `images[]` khi tạo/sửa Product. Backend trả về `images[].url` để hiển thị.

FE **không bao giờ gửi `url`** vào body. Lúc submit, ảnh còn ở vùng tạm `tmp/`; backend xác minh key, copy sang `products/<productId>/…` rồi mới tạo `url`. Nhận `key` thay vì `url` cũng chặn việc client gắn một link bất kỳ.

```
 FE                                  Backend                        Storage
  │ ① POST /api/v1/upload-images/presign │                             │
  │ ───────────────────────────────────▶ │ kiểm tra role, ký policy    │
  │ ◀── [{ key, uploadUrl, fields }]     │                             │
  │ ② POST {uploadUrl}  multipart (fields + file) ──────────────────▶  │ kiểm tra size/type/hạn
  │ ◀──────────────────────────────────────────────────────── 204      │ → tmp/product-image/<uuid>.jpg
  │ ③ POST/PATCH /api/v1/products { images: [{ key }] }                │
  │ ───────────────────────────────────▶ │ HEAD key, COPY → products/, │
  │                                      │ transaction DB, dọn tmp     │
  │ ◀── { ..., images: [{ id, url }] }   │                             │
```

## Quy tắc cần biết

- Mỗi Product có **1–5 ảnh**. Thứ tự mảng `images[]` là thứ tự hiển thị; `images[0]` là Cover Image. Không có `isPrimary`/`sortOrder`.
- File: `image/jpeg`, `image/png`, `image/webp`, ≤ 5 MB. Presign tối đa 5 file mỗi request.
- Presign hết hạn **15 phút** (tính tới lúc bắt đầu upload) — upload ngay sau khi presign.
- Ảnh đã upload nhưng chưa gắn sống **1 ngày** trong `tmp/`, sau đó tự bị xoá → người dùng có tối đa 1 ngày để bấm Lưu.
- Chỉ `STORE_MANAGER`/`MASTER_ADMIN` presign và ghi Product được.

## ① Presign

```http
POST /api/v1/upload-images/presign
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "purpose": "PRODUCT_IMAGE",
  "files": [
    { "filename": "front.jpg", "contentType": "image/jpeg" },
    { "filename": "back.png", "contentType": "image/png" }
  ]
}
```

`filename` chỉ mang tính thông tin — không dùng để đặt tên key.

**201** — một phần tử mỗi file, đúng thứ tự gửi:

```json
[
  {
    "key": "tmp/product-image/c73fb45a-77a1-4875-a30e-28607156e2fc.jpg",
    "uploadUrl": "http://localhost:9000/media",
    "fields": {
      "bucket": "media",
      "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
      "X-Amz-Credential": "…",
      "X-Amz-Date": "…",
      "key": "tmp/product-image/c73fb45a-77a1-4875-a30e-28607156e2fc.jpg",
      "Content-Type": "image/jpeg",
      "Policy": "…",
      "X-Amz-Signature": "…"
    }
  }
]
```

FE không cần hiểu `fields`, chỉ gửi lại nguyên vẹn ở bước ②.

## ② Upload lên storage

Gửi thẳng tới `uploadUrl`, **không** kèm `Authorization`. Mọi `fields` đứng trước, `file` là field **cuối cùng**.

```ts
type PresignedTarget = { key: string; uploadUrl: string; fields: Record<string, string> };

// Dùng XHR thay fetch để có progress upload.
function upload(target: PresignedTarget, file: File, onProgress: (pct: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    Object.entries(target.fields).forEach(([name, value]) => form.append(name, value));
    form.append('file', file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', target.uploadUrl);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => (xhr.status === 204 || xhr.status === 201 ? resolve(target.key) : reject(xhr.responseText));
    xhr.onerror = () => reject(new Error('Network error'));
    xhr.send(form);
  });
}
```

| Response               | Ý nghĩa                                                           |
| ---------------------- | ----------------------------------------------------------------- |
| `204`                  | Thành công — lưu `key`                                            |
| `400` `EntityTooLarge` | File > 5 MB                                                       |
| `403` `AccessDenied`   | Sai `Content-Type` hoặc presign quá 15 phút → presign lại file đó |

Storage trả lỗi dạng XML (`<Error><Code>…</Code></Error>`), không phải JSON của backend.

## Màn hình tạo Product

1. Người dùng chọn ảnh → preview ngay bằng `URL.createObjectURL(file)`; validate trước type/size/số lượng cho UX.
2. Presign cả lô → upload song song, hiện progress và trạng thái từng ảnh (đang tải / xong / lỗi + thử lại).
3. Người dùng sắp xếp, xoá, nhập `altText` — chỉ là state FE. Xoá ảnh đã upload chỉ cần bỏ khỏi state (ảnh trong `tmp/` tự hết hạn).
4. Khoá nút Lưu khi còn ảnh đang tải hoặc lỗi. Gửi:

```http
POST /api/v1/products
Authorization: Bearer <accessToken>

{
  "name": "Áo thun basic",
  "categoryId": "550e8400-e29b-41d4-a716-446655440000",
  "code": "TSB001",
  "variants": [
    { "colorId": "<id Đen>", "sizeId": "<id M>", "price": 199000 },
    { "colorId": "<id Trắng>", "sizeId": "<id M>", "price": 199000 }
  ],
  "images": [
    { "key": "tmp/product-image/c73fb45a-….jpg", "altText": "Mặt trước" },
    { "key": "tmp/product-image/9a1e0b77-….png" }
  ]
}
```

**201** — `images[]` giờ có `url` thật, thay preview tạm bằng `url`:

```json
{
  "id": "0f8e7d6c-…",
  "name": "Áo thun basic",
  "code": "TSB001",
  "slug": "ao-thun-basic",
  "status": "ACTIVE",
  "variants": [
    {
      "id": "a1b2…",
      "sku": "TSB001-BLK-M",
      "price": "199000.00",
      "status": "ACTIVE",
      "color": { "id": "…", "name": "Đen", "code": "BLK" },
      "size": { "id": "…", "name": "M", "code": "M" }
    }
  ],
  "images": [
    {
      "id": "e5f6a7b8-…",
      "productId": "0f8e7d6c-…",
      "url": "http://localhost:9000/media/products/0f8e7d6c-…/c73fb45a-….jpg",
      "altText": "Mặt trước",
      "createdAt": "2026-09-24T08:46:12.345Z"
    }
  ]
}
```

## Variants, Option Value và SKU

Màu và size **chọn từ danh sách**, không gõ tay. SKU do backend ghép: `<code>-<mã màu>-<mã size>` (ví dụ `TSB001-BLK-M`), FE không gửi `sku`.

1. Lấy dropdown: `GET /api/v1/option-values?type=COLOR` và `?type=SIZE` (public, đã sắp theo `position`, không chứa giá trị đang ẩn).
2. Người dùng nhập **Product Code** (`code`): 2–20 ký tự `A-Z`/`0-9`, **chữ in hoa** — backend không tự viết hoa, gửi chữ thường → 400. Không đổi được sau khi tạo.
3. Mỗi dòng variant: chọn màu và/hoặc size (đều không bắt buộc) + nhập giá. Product không có biến thể gửi 1 variant chỉ có `price`, SKU = `code`.
4. Có thể hiện trước SKU cho người dùng bằng cùng công thức, nhưng SKU trong response mới là giá trị thật.

Quy tắc:

- Tạo Product cần ≥ 1 variant. Cùng tổ hợp màu + size hai lần → 409.
- Màu/size của variant **không đổi được**. Chọn nhầm → bỏ variant đó khỏi mảng (thành `DISCONTINUED`) rồi thêm variant mới. Tổ hợp đã từng dùng (kể cả đã `DISCONTINUED`) không tạo lại được — 409. Định tạm ngừng rồi bán lại → dùng `status: INACTIVE`, đừng bỏ variant khỏi mảng.
- Tối đa 50 variant `ACTIVE` + `INACTIVE`; luôn phải còn ≥ 1 variant `ACTIVE`. Muốn ngừng bán cả product → đổi `status` của product sang `INACTIVE`.
- Staff quản lý danh sách màu/size ở màn riêng: `POST/PATCH/DELETE /api/v1/option-values` (đổi tên, sắp thứ tự, `hidden: true` để ẩn; đang được dùng thì không xoá được — 409).

## Màn hình sửa Product

**Tải product bằng `GET /api/v1/products/:id?includeAllVariants=true`** (cần token staff). Không có cờ này, API chỉ trả variant `ACTIVE` — gửi lại danh sách thiếu đó trong `PATCH` sẽ **discontinue** các variant bị bỏ sót.

`variants[]` của `PATCH` cũng là toàn bộ danh sách mong muốn: variant cũ gửi `{ id, price?, status? }` (không gửi `colorId`/`sizeId`), variant mới gửi `{ colorId?, sizeId?, price }`, variant vắng mặt thành `DISCONTINUED`. Không đụng tới variant → không gửi field `variants`.

`images[]` của `PATCH` là **toàn bộ danh sách mong muốn**, theo thứ tự hiển thị:

- Ảnh cũ giữ lại → `{ id }` (có thể kèm `altText` mới).
- Ảnh mới → `{ key }` sau khi đã presign + upload như trên.
- Ảnh cũ không có trong mảng → bị xoá.
- Không đụng tới ảnh → **không gửi field `images`**.

```http
PATCH /api/v1/products/:id

{
  "images": [
    { "id": "img-b" },
    { "key": "tmp/product-image/new-….png", "altText": "Mặt sau" }
  ]
}
```

- Đổi Cover Image = đưa ảnh đó lên đầu mảng.
- Thay một ảnh = bỏ `{ id }` cũ, đặt `{ key }` mới vào đúng vị trí đó. Ảnh mới có `id` mới; `altText` phải gửi lại.
- Danh sách cuối phải có 1–5 ảnh.

**Hai người cùng sửa**: người lưu sau thay thế toàn bộ danh sách (ADR 0012). Nếu người khác vừa thêm ảnh mà form của bạn tải trước đó, lưu form sẽ xoá ảnh đó. Nên tải lại product trước khi mở form sửa.

## Xử lý lỗi khi lưu

Lỗi backend có shape `{ statusCode, message, requestId }`.

| Response                                | FE nên làm                                                                       |
| --------------------------------------- | -------------------------------------------------------------------------------- |
| 400 `Uploaded image not found: <key>`   | Đánh dấu đúng ảnh đó lỗi, yêu cầu upload lại (thường do để quá 1 ngày)           |
| 400 key sai prefix/format               | Bug FE — gửi nhầm giá trị không phải `key` từ presign                            |
| 400 số ảnh ngoài 1–5                    | Báo người dùng thêm/bớt ảnh                                                      |
| 409 trùng tên / Product Code / SKU      | Báo lỗi field tương ứng; **giữ nguyên ảnh** — key trong `tmp/` vẫn dùng lại được |
| 400 Option Value không chọn được        | Màu/size vừa bị ẩn hoặc xoá — tải lại dropdown                                   |
| 400 không còn variant `ACTIVE` / quá 50 | Báo người dùng; ngừng bán cả product bằng `status`                               |
| 409 ảnh vừa bị xoá bởi request khác     | Tải lại product, cho người dùng thao tác lại                                     |
| 503 storage không phản hồi              | Nút "Thử lại" với cùng payload, không cần upload lại                             |

## Môi trường

- Local (`docker-compose`): `uploadUrl` và `url` trỏ `http://localhost:9000`, truy cập được từ máy dev.
- Production (S3): bucket phải bật CORS cho origin của FE, nếu không browser chặn bước ②. Xem mục Deployment trong spec 03.
