# Object Storage cho Product Images — Design Spec

> Sub-project cuối của Phase 2 (Mục 22), sau Products + Product Variants (`docs/superpowers/specs/2026-09-18-products-and-variants-design.md`). Tài liệu kiến trúc (Mục 8) tự ghi nhận contract này chưa chốt — đã chốt qua brainstorming, xem Mục 4.

## 1. Bối cảnh & vấn đề

Model `ProductImage` đã có sẵn trong `prisma/schema/schema.prisma` và đã migrate (`20260911030156_init_ecommerce`), gồm 1 partial unique index viết tay (`product_images.product_id WHERE is_primary = true` — mỗi product tối đa 1 ảnh primary). Chưa có module nào ghi/đọc bảng này, và Mục 0 tài liệu kiến trúc xác nhận Object Storage 🔴 chưa có (Docker/CI plan ở Phase 1 chỉ chuẩn bị container Postgres/Redis, chưa có storage).

## 2. Phạm vi (Scope)

1. Upload ảnh gắn vào 1 Product đã tồn tại (`POST /products/:id/images`).
2. Danh sách ảnh của 1 Product (`GET /products/:id/images`).
3. Đặt 1 ảnh làm primary (`PATCH /products/:id/images/:imageId/primary`).
4. Xoá ảnh (`DELETE /products/:id/images/:imageId`).
5. MinIO (S3-compatible) thêm vào `docker-compose.yml` (đã có từ Phase 1 plan) cho local dev.

## 3. Non-goals

- Resize/optimize ảnh (thumbnail generation, nhiều size) — chưa cần cho MVP.
- CDN trước storage — production deployment concern (Mục 16), không phải Phase 2.
- Batch upload nhiều ảnh trong 1 request — mỗi lần gọi API upload đúng 1 ảnh (đã chốt qua brainstorming).
- Presigned URL (client upload trực tiếp lên storage) — đã chốt dùng backend proxy upload (xem Mục 4.2).
- Sắp xếp lại thứ tự ảnh (`sortOrder`) qua 1 endpoint riêng — cột `sortOrder` đã có trong schema nhưng việc cho phép client tự sắp xếp lại chưa có API tương ứng ở Phase 2 này; ảnh mới upload luôn nối vào cuối theo thứ tự tạo (`sortOrder` tăng dần theo thời gian tạo), chưa hỗ trợ reorder.

## 4. Kiến trúc & quyết định đã chốt

### 4.1 Storage provider

**Quyết định (đã chốt qua brainstorming):** MinIO (S3-compatible), chạy như 1 service trong `docker-compose.yml` cho local dev. Production dùng S3 thật/tương đương (Mục 1 đã chốt hướng này) — code dùng chung 1 S3 client SDK (`@aws-sdk/client-s3`) cho cả 2 môi trường, chỉ khác `endpoint`/credentials qua `ConfigService`, không viết code riêng cho từng provider.

### 4.2 Upload flow — backend proxy (không dùng presigned URL)

**Quyết định (đã chốt qua brainstorming):** Client gửi file qua `multipart/form-data` thẳng tới 1 endpoint NestJS (không xin presigned URL trước). Backend nhận file vào memory (`multer`, qua `FileInterceptor` của `@nestjs/platform-express`), validate mime type + size, rồi tự đẩy lên MinIO/S3 bằng S3 client SDK. Lý do chọn: đơn giản hơn để implement/test, và backend kiểm soát được validate nội dung file trước khi nó nằm trên storage (presigned URL để client upload trực tiếp thì backend không chặn được file sai định dạng cho tới sau khi đã lưu).

- Mime type cho phép: `image/jpeg`, `image/png`, `image/webp`. Sai mime type → `400`.
- Size tối đa: 5MB. Vượt quá → `400`.
- Object key trên storage: `products/{productId}/{uuid}.{ext}` (uuid random, tránh trùng tên file gốc từ nhiều client khác nhau).

### 4.3 `ObjectStorageService` — interface tách khỏi S3 client thật (cho testability)

**Quyết định (đã chốt qua brainstorming, kỹ thuật — không cần user chọn thêm):** Bọc S3 client sau 1 interface riêng, không gọi `@aws-sdk/client-s3` trực tiếp từ `ProductsService`:

```typescript
// src/products/object-storage.service.ts (interface + implementation thật)
export interface UploadedObject {
  key: string;
  url: string;
}

export interface ObjectStorageService {
  upload(key: string, buffer: Buffer, contentType: string): Promise<UploadedObject>;
  delete(key: string): Promise<void>;
}
```

`S3ObjectStorageService` (implementation thật, dùng `@aws-sdk/client-s3`) đăng ký làm provider cho token này trong `ProductsModule`. E2e test override provider này bằng 1 fake in-memory — giống cách `ThrottlerGuard`/`EmailThrottlerGuard` đã được override trong `test/support/create-test-app.ts` — tránh phải chạy MinIO thật trong CI chỉ để test business logic (validate mime/size, DB row, primary-switch transaction).

### 4.4 API chi tiết

```
POST   /api/v1/products/:id/images                 — STORE_MANAGER/MASTER_ADMIN
GET    /api/v1/products/:id/images                  — public
PATCH  /api/v1/products/:id/images/:imageId/primary  — STORE_MANAGER/MASTER_ADMIN
DELETE /api/v1/products/:id/images/:imageId          — STORE_MANAGER/MASTER_ADMIN
```

- **`POST .../images`**: body `multipart/form-data` — field `file` (bắt buộc), `altText` (optional string). 404 nếu `productId` không tồn tại. Ảnh **đầu tiên** của product tự động `isPrimary = true`; ảnh sau đó default `isPrimary = false`.
- **`GET .../images`**: trả `ProductImage[]` (không phân trang — số ảnh mỗi product luôn nhỏ, không cần).
- **`PATCH .../:imageId/primary`**: chạy trong **1 transaction Prisma**: `UPDATE product_images SET is_primary = false WHERE product_id = :id AND is_primary = true` (unset ảnh primary cũ, nếu có), rồi `UPDATE product_images SET is_primary = true WHERE id = :imageId` — bắt buộc atomic vì partial unique index không cho phép có khoảnh khắc 2 ảnh cùng primary.
- **`DELETE .../:imageId`**: xoá row DB **trước**, gọi `ObjectStorageService.delete()` **sau** (best-effort — lỗi chỉ log lại, không rollback DB; giống pattern gửi email best-effort trong `AuthService.sendBestEffort()`). Lý do thứ tự: ảnh bị unlink khỏi product (điều user thấy/quan tâm) quan trọng hơn việc storage có object rác tạm thời — object rác không ảnh hưởng nghiệp vụ, có thể dọn sau bằng job riêng (ngoài phạm vi này).

## 5. Testing

- Unit test `ProductsService` (hoặc 1 service riêng `product-images.service.ts` — xem Mục 7 cấu trúc thư mục) với `ObjectStorageService` + `PrismaService` mock: validate mime/size (400 khi sai), ảnh đầu tiên tự động primary, transaction switch primary (assert cả 2 lệnh `update` trong `$transaction`), xoá ảnh gọi cả DB delete và storage delete.
- E2e test dùng fake `ObjectStorageService` override trong `createTestApp()` — upload thật qua HTTP (`supertest` với `.attach('file', buffer, filename)`), xác nhận DB row đúng, 401/403 khi role sai, 400 khi mime/size sai, 404 khi `productId` không tồn tại.

## 6. Error handling

Validate mime/size chặn **trước** khi gọi storage (không để lỗi rơi xuống S3 SDK rồi map ngược lại — tốn 1 network call vô ích cho input rõ ràng sai ngay từ đầu). Lỗi thật từ storage (network, credentials sai, bucket không tồn tại) rơi xuống `AllExceptionsFilter` như lỗi 500 không lường trước — không cần custom exception mapping riêng cho trường hợp storage-down ở MVP này (Mục 15 tài liệu kiến trúc: observability nâng cao là Phase 9).

## 7. Cấu trúc thư mục

```
src/products/
├── ... (đã có từ Products + Variants)
├── object-storage.service.ts       # interface ObjectStorageService + implementation S3ObjectStorageService
├── product-images.controller.ts    # route ảnh — tách riêng khỏi ProductsController vì đã có 10 route Product+Variant, thêm 4 route ảnh vào cùng file sẽ vượt ngưỡng dễ đọc (~300 dòng, docs/convention/coding-style-conventions.md §7)
├── product-images.service.ts       # business logic ảnh — tách theo lý do tương tự
├── product-images.service.spec.ts
└── dto/
    └── upload-image.dto.ts          # chỉ có `altText?: string` — field `file` không khai ở đây, nhận qua FileInterceptor + @UploadedFile(), không qua @Body()
```

Không cần DTO cho `PATCH .../:imageId/primary` — endpoint này không nhận body, chỉ dựa vào `imageId` ở path param.

Không cần migration mới — `ProductImage` đã có sẵn trong schema. Cần thêm `minio` vào `docker-compose.yml` (đã có từ Phase 1 plan) và biến môi trường mới (`S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_REGION` hoặc tương đương) vào `.env.example` + `src/config/env.validation.ts`.
