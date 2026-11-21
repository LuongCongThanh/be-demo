# Module `catalog`

> Trạng thái: **Đã chốt cho MVP** ([quy ước](../../README.md#trạng-thái-tài-liệu)). Bảng: [`../11-database.md`](../11-database.md). Ranh giới: [`../02-modules.md`](../02-modules.md). Nguồn nghiệp vụ: [business/04](../../business/04-business-rules.md) §1 (BR-CAT-*), [business/03](../../business/03-user-stories.md) E1, E8.

## 1. Trách nhiệm

- Sở hữu: Danh mục nhiều cấp, Sản phẩm, Biến thể size × màu, danh sách size, bảng màu, ảnh theo màu, tìm kiếm/lọc/sắp xếp storefront, số liệu bán chạy.
- Không sở hữu: Giá khuyến mãi (`pricing`), Tồn kho (`inventory`). Storefront hiển thị "Hết hàng" (BR-CAT-08) bằng cách hỏi `inventory`.

## 2. Mô hình

Chi tiết cột, ràng buộc, enum: [`../11-database.md` §4.2](../11-database.md#42-catalog).

- `categories` — cây Danh mục
- `products` — Sản phẩm
- `sizes`, `colors` — danh sách size/màu dùng chung
- `product_variants` — Biến thể size × màu, mang SKU và Giá bán
- `product_images` — ảnh theo màu
- `product_sales_stats` — số liệu bán chạy 30 ngày

## 3. Interface cho module khác

| Hàm                                                                                  | Dùng bởi                                      |
| ------------------------------------------------------------------------------------ | --------------------------------------------- |
| `getSellableVariants(ids, tx?)` → tên, SKU, size, màu, Giá bán, cân nặng, trạng thái | `cart`, `ordering` (bản chụp), `pricing`      |
| `assertVariantSellable(id)`                                                          | `cart` (US-202 AC2)                           |
| `markSkuLocked(variantIds, tx)`                                                      | `ordering` khi tạo đơn đầu tiên chứa Biến thể |

## 4. API

| Method | Path                                              | Actor     | Ghi chú                                                                                                                                     |
| ------ | ------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`  | `/categories`                                     | mọi người | Cây danh mục                                                                                                                                |
| `GET`  | `/products`                                       | mọi người | `category`, `size`, `color`, `priceMin/Max` (theo Giá áp dụng), `q`, `sort` = `newest`/`price_asc`/`price_desc`/`best_selling` (US-101–103) |
| `GET`  | `/products/slug/:slug`                            | mọi người | Biến thể, ảnh theo màu, Giá áp dụng, còn hàng (US-104)                                                                                      |
| `CRUD` | `/admin/categories`                               | admin     | US-801                                                                                                                                      |
| `CRUD` | `/admin/products`, `/admin/products/:id/variants` | admin     | US-802; sinh ma trận Biến thể                                                                                                               |
| `POST` | `/admin/products/:id/publish` · `/archive`        | admin     | US-803                                                                                                                                      |
| `POST` | `/admin/products/:id/images`                      | admin     | Upload lên object storage, gắn màu                                                                                                          |
| `CRUD` | `/admin/sizes`, `/admin/colors`                   | admin     | US-805; xoá → ẩn nếu đã dùng                                                                                                                |

## 5. Luồng

### 5.1. Tìm kiếm (BR-CAT-13)

Chuẩn hoá từ khoá: trim, lowercase, bỏ dấu tiếng Việt (gồm `đ → d`); rỗng → không lọc. Truy vấn `search_name LIKE '%' || :q || '%'` (cột generated, index GIN trigram `pg_trgm`), kết hợp với bộ lọc và sắp xếp. Không fuzzy.

### 5.2. Xoá và lưu trữ

Sản phẩm/Biến thể đã có trong đơn không xoá cứng, chỉ `archived` (BR-CAT-09). Danh mục còn Sản phẩm hoặc Danh mục con → `409` kèm số lượng (ADR 0001).

## 6. Sự kiện

| Phát | Nghe                                                                                                 |
| ---- | ---------------------------------------------------------------------------------------------------- |
| —    | `ordering.order-placed`, `ordering.order-paid` không cần; số bán chạy tính từ `order_items` bằng job |

## 7. Job

| Job           | Tần suất | Hành vi                                                                                                                           |
| ------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Tính bán chạy | Mỗi đêm  | Tổng số lượng Dòng đơn hàng của đơn đã vào `PLACED`, chưa huỷ, không Hoàn hàng, trong 30 ngày (BR-CAT-12) → `product_sales_stats` |

## 8. Bao phủ

BR-CAT-01–13; US-101–104, US-801–803, US-805; ADR 0001.

## 9. Câu hỏi mở

- Đọc dữ liệu đơn cho job bán chạy: qua view do `ordering` cung cấp hay đặt job ở `reporting`? Đề xuất: `reporting` tính và ghi qua interface của `catalog`.

## Category content — triển khai 2026-11-19

[Spec và contract](../../plan/tasks/24-category-content/spec.md), [hướng dẫn consumer](../../plan/tasks/24-category-content/guide.md).

- GET `/categories` và `/categories/:id` nhận `locale=vi|en`, default vi; name theo locale và giữ nameVi/nameEn; ảnh optional URL nullable. Slug không đổi khi rename/move/locale.
- POST/PATCH admin category nhận nameEn tùy chọn để sửa tay; null yêu cầu dịch lại. GET admin trả tên Việt, trạng thái dịch và hai storage keys/URLs; không lộ version/lease.
- POST `/admin/categories/:id/translation/retry` chỉ quyền category manage; reset PENDING, giữ tên Anh hiện tại tới khi có kết quả mới.
- POST `/admin/categories/:id/images/:slot/presign`, PATCH `/admin/categories/:id/images/:slot` với slot thumbnail/banner. Upload trực tiếp Cloudinary; attach kiểm file thật, ≤5MB JPEG/PNG/WebP. Null gỡ ảnh.
- Worker poll mỗi 5 giây, batch 10, lease 60 giây, timeout Google 10 giây; chỉ bật khi có GOOGLE_TRANSLATE_API_KEY. Claim/complete có điều kiện version/status/lease; lỗi FAILED chờ retry. Không gọi HTTP trong transaction. API ghi không đợi dịch.
- Hidden branch không truy cập/filter được, filter cha bỏ nhánh con ẩn; search không có categoryId giữ quy tắc sản phẩm hiện có.

### Tương thích locale — ticket 01

Bản dịch Anh hiện nằm trong `category_translations` (PK categoryId + locale), không còn dùng cột legacy làm nguồn dữ liệu. `nameEn`/`translationStatus` trên mọi response và request cũ là adapter cho `en`, kể cả response gắn ảnh. `categories.name` giữ nguồn Việt, `sourceVersion` tăng khi rename; revision/lease thuộc từng bản dịch. Worker chỉ nhận `en` PENDING, ghi có điều kiện theo sourceVersion/revision/lease, giữ manual/review và bỏ kết quả cũ sau rename/manual/retry/delete. Chưa thêm API quản lý ngôn ngữ trong ticket này. Rollout phải dừng writer cũ trước migration; xem hướng dẫn task category.

### Biên tập bản dịch theo locale — ticket 03

Admin đọc danh sách `{ locale, name, status, updatedAt }`; không trả revision,
source version, generation hay lease ra contract. PATCH nhận chuỗi không rỗng để
đặt MANUAL hoặc `name: null` để xóa override và đưa đúng locale về PENDING. Retry
riêng locale giữ tên hiện có tới khi dịch thành công; endpoint retry cũ và
`nameEn` vẫn chiếu vào cùng dòng `en`. `vi` không phải locale đích; locale khác
phải được cấu hình và bật. Ghi biên tập/retry dùng transaction, advisory lock
chung với enable/disable locale và row lock category, sau đó conditional write
theo source version, revision và generation. Worker vẫn dùng lease/conditional
completion, nên kết quả đang chạy không thể ghi đè edit, rename, retry, disable
hoặc delete đã commit.

## As-built — triển khai hiện tại (2026-11-22)

Phần này mô tả runtime trong `src/modules/catalog/**`. `CatalogModule` đăng ký product, product-option và sale price, đồng thời import `CategoryModule`; `CategoryModule` sở hữu Category controllers, Application services/ports và DI composition. Category persistence, translation và image storage được nối qua các adapter Infrastructure; các feature Catalog còn lại vẫn dùng `PrismaService` trực tiếp. `ProductService` đọc cây hiển thị từ helper thuần của Category và giá khuyến mãi qua helper trong pricing; `AdminProductService` tạo inventory row `quantity=0` khi tạo Biến thể và gọi helper khóa/kiểm giá trong pricing.

| File                                             | Trách nhiệm, symbol chính và phụ thuộc đáng kể                                                                                                          |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/modules/catalog/catalog.module.ts`          | `CatalogModule`: composition root cho product, product-option và sale price; import `CategoryModule`, `PassportModule` và `StorageModule`.                |
| `src/modules/catalog/category/category.module.ts` | `CategoryModule`: wiring Category HTTP adapters, Application providers và các Application Port sang concrete Infrastructure adapters.                  |
| `src/modules/catalog/category/category-core.module.ts` | `CategoryCoreModule`: import persistence/Storage infrastructure, bind Category Port/adapter và export shared application providers. |
| `src/modules/catalog/category/admin/admin-category.module.ts` | `AdminCategoryModule`: import `CategoryCoreModule` trực tiếp, đăng ký Admin controllers và Admin application providers. |
| `src/modules/catalog/category/storefront/storefront-category.module.ts` | `StorefrontCategoryModule`: import `CategoryCoreModule` trực tiếp, đăng ký Storefront controllers và Storefront application providers. |

### API hiện tại

| Method                    | Path                                                                                                                          | Hành vi hiện tại                                                                                               |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `GET`                     | `/categories`, `/categories/:id`                                                                                              | Cây/chi tiết Danh mục hiển thị; `locale` phải được bật, mặc định `vi`.                                         |
| `GET`                     | `/languages`                                                                                                                  | Ngôn ngữ nội dung Danh mục đang bật, public.                                                                   |
| `GET`                     | `/admin/categories`, `/admin/categories/:id`                                                                                  | Danh sách phân trang/chi tiết, gồm Danh mục ẩn; STAFF/ADMIN đọc.                                               |
| `POST`, `PATCH`, `DELETE` | `/admin/categories`, `/admin/categories/:id`                                                                                  | ADMIN tạo, sửa/chuyển cây/ẩn, xóa lá rỗng; không xóa được khi có con hoặc Sản phẩm.                            |
| `POST`, `PATCH`           | `/admin/categories/:id/images/:slot/presign`, `/admin/categories/:id/images/:slot`                                            | Tải trực tiếp và gắn/gỡ ảnh `thumbnail` hoặc `banner`; kiểm chứng tệp qua Cloudinary.                          |
| `POST`, `GET`, `PATCH`    | `/admin/categories/:id/translation/retry`, `/admin/categories/:id/translations`, `/admin/categories/:id/translations/:locale` | Retry tiếng Anh tương thích; đọc/sửa bản dịch theo locale. `POST .../translations/:locale/retry` retry locale. |
| `GET`, `PATCH`            | `/admin/languages`, `/admin/languages/:locale`                                                                                | Đọc và bật/tắt ngôn ngữ nội dung Danh mục.                                                                     |
| `GET`                     | `/products`                                                                                                                   | Danh sách sản phẩm ACTIVE, filter/search/sort và giá tổng hợp bằng raw SQL; phân trang.                        |
| `GET`                     | `/products/slug/:slug`, `/products/:id`                                                                                       | Chi tiết theo slug hoặc UUID, với Biến thể ACTIVE, ảnh và giá khuyến mãi đang hiệu lực.                        |
| `GET`                     | `/products/:id/variants`, `/products/:id/variants/:variantId`                                                                 | Danh sách/chi tiết Biến thể ACTIVE.                                                                            |
| `GET`, `POST`, `PATCH`    | `/admin/products`, `/admin/products/:id`                                                                                      | Back-office list/detail/create/update. Không có DELETE; chuyển trạng thái qua archive/unarchive.               |
| `POST`                    | `/admin/products/:id/archive`, `/admin/products/:id/unarchive`                                                                | Đổi trạng thái Sản phẩm; archive/unarchive lặp lại an toàn.                                                    |
| `POST`, `PATCH`           | `/admin/products/:id/variants`, `/admin/products/:id/variants/:variantId`                                                     | Tạo/cập nhật Biến thể; có route archive/unarchive riêng cho Biến thể.                                          |
| `POST`, `PATCH`, `DELETE` | `/admin/products/:id/images/presign`, `/admin/products/:id/images`, `/admin/products/:id/images/:imageId`                     | Presign, gắn, sửa và xóa ảnh sản phẩm.                                                                         |
| `GET`                     | `/sizes`, `/colors`                                                                                                           | Storefront nhận danh sách Size/Bảng màu không ẩn.                                                              |
| `GET`, `POST`, `PATCH`    | `/admin/sizes`, `/admin/sizes/:id`, `/admin/colors`, `/admin/colors/:id`                                                      | Back-office đọc/ghi Size và Bảng màu; không có DELETE.                                                         |

### Kiểm kê runtime theo file

Các đường dẫn dưới đây kiểm kê các file TypeScript chính trong catalog ngoài phần sale price (được kiểm kê ở `pricing.md`). Các DTO là hợp đồng validation/serialization của controller, không phải service/interface liên module.

#### Category

| File                                                                                   | Trách nhiệm, symbol chính và phụ thuộc đáng kể                                                                                                                           |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/modules/catalog/category/infrastructure/integrations/translation/category-translation.client.ts`                  | `CategoryTranslationClient`: adapter dịch ngoài; dùng `ConfigService`, được worker gọi.                                                                                  |
| `src/modules/catalog/category/controllers/admin/admin-category.controller.ts`          | `AdminCategoryController`: CRUD, translation retry/list/update; gọi `AdminCategoryService`, mapper và `CloudinaryClient`; bảo vệ bằng permission category.               |
| `src/modules/catalog/category/controllers/admin/admin-category-image.controller.ts`    | `AdminCategoryImageController`: presign/attach ảnh category theo slot; gọi `AdminCategoryImageService`, dùng DTO/enum và response ảnh presign dùng chung với product.    |
| `src/modules/catalog/category/controllers/admin/admin-category-language.controller.ts` | `AdminCategoryLanguageController`: list và bật/tắt locale; gọi `CategoryLanguageService`, permission view/manage và khai báo response qua `CategoryLanguageResponseDto`. |
| `src/modules/catalog/category/controllers/storefront/category.controller.ts`           | `CategoryController`: `GET /categories` và `/:id`; kiểm locale qua `CategoryLanguageService`, lấy nội dung từ `CategoryService`.                                         |
| `src/modules/catalog/category/controllers/storefront/category-language.controller.ts`  | `CategoryLanguageController`: storefront đọc locale/ngôn ngữ được hỗ trợ; gọi `CategoryLanguageService`, response dùng `CategoryLanguageResponseDto`.                    |
| `src/modules/catalog/category/domain/image/category-image.constants.ts`                      | `CATEGORY_IMAGE_FORMATS`, `CATEGORY_IMAGE_MAX_BYTES`, `categoryImagePrefix`, `isCategoryImageKey`: quy tắc và kiểm tra storage key; phụ thuộc `CategoryImageSlot`.       |
| `src/modules/catalog/category/domain/image/category-image-slot.enum.ts`                      | `CategoryImageSlot`: tập slot ảnh thumbnail/banner.                                                                                                                      |
| `src/modules/catalog/category/domain/localization/category-locale.ts`                               | `CATEGORY_SUPPORTED_LOCALES`, `CategoryLocale`, `isCategoryLocale`: kiểu và kiểm tra locale.                                                                             |
| `src/modules/catalog/category/domain/tree/category-tree.ts`                                 | `buildVisibleTree`, `isEffectivelyVisible`: dựng cây và xét ẩn theo tổ tiên; dùng kiểu Prisma `Category` và `CategoryTreeNodeDto`.                                       |
| `src/modules/catalog/category/dto/admin/image/category-image.dto.ts`                         | `PresignCategoryImageDto`, `SetCategoryImageDto`: input upload/gắn ảnh; dùng quy tắc image key.                                                                          |
| `src/modules/catalog/category/dto/admin/localization/category-language.dto.ts`                      | `UpdateCategoryLanguageDto`: input bật/tắt locale.                                                                                                                       |
| `src/modules/catalog/category/dto/admin/category/create-category.dto.ts`                        | `CreateCategoryDto`: input tạo Danh mục; dùng validator/Swagger.                                                                                                         |
| `src/modules/catalog/category/dto/admin/category/paginated-category-response.dto.ts`            | `PaginatedCategoryResponseDto`: response phân trang admin, ghép DTO danh mục và pagination metadata.                                                                     |
| `src/modules/catalog/category/dto/admin/category/update-category.dto.ts`                        | `UpdateCategoryDto`: input sửa Danh mục, mở rộng `CreateCategoryDto`.                                                                                                    |
| `src/modules/catalog/category/dto/shared/category-response.dto.ts`                     | `CategoryResponseDto`: schema response category dùng chung/admin.                                                                                                        |
| `src/modules/catalog/category/dto/shared/category-language-response.dto.ts`            | `CategoryLanguageResponseDto`: response locale/enabled/generation và timestamp cho storefront/admin.                                                                     |
| `src/modules/catalog/category/dto/storefront/category-locale-query.dto.ts`             | `CategoryLocaleQueryDto`: query locale storefront; kiểm với `CategoryLocale`.                                                                                            |
| `src/modules/catalog/category/dto/storefront/category-tree-node.dto.ts`                | `CategoryTreeNodeDto`: node cây storefront và nội dung locale/ảnh/con.                                                                                                   |
| `src/modules/catalog/category/dto/storefront/public-category-response.dto.ts`          | `PublicCategoryResponseDto`: response public mở rộng DTO shared.                                                                                                         |
| `src/modules/catalog/category/presentation/mappers/shared/category-response.mapper.ts`              | `categoryTranslations`, `categoryContent`, `publicCategory`, `adminCategory`; map Prisma category/translation thành response, tạo URL qua `CloudinaryClient`.            |
| `src/modules/catalog/category/application/services/admin/image/admin-category-image.service.ts`          | `AdminCategoryImageService`: presign, kiểm ảnh/slot/key và gắn/gỡ ảnh; dùng Prisma và Cloudinary.                                                                        |
| `src/modules/catalog/category/application/services/admin/category/admin-category.service.ts`                | `AdminCategoryService`: quản lý cây, slug, xóa rỗng, nội dung và bản dịch; Prisma, pagination, slug utility, Prisma error mapping.                                       |
| `src/modules/catalog/category/application/services/shared/localization/category-language.service.ts`            | `CategoryLanguageService`: liệt kê, bật/tắt và xác nhận locale; dùng Prisma và `CategoryLocale`.                                                                         |
| `src/modules/catalog/category/application/services/shared/translation/category-translation.service.ts`         | `CategoryTranslationService`: worker poll/lease batch, dịch và ghi kết quả có điều kiện; lifecycle Nest, Prisma và translation client.                                   |
| `src/modules/catalog/category/application/services/storefront/category/category.service.ts`                 | `CategoryService`: trả cây/chi tiết hiển thị theo locale; dùng Prisma, tree helpers, mapper và Cloudinary.                                                               |

#### Product

| File                                                                                   | Trách nhiệm, symbol chính và phụ thuộc đáng kể                                                                                                                                                              |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/modules/catalog/product/controllers/admin/admin-product.controller.ts`            | `AdminProductController`: back-office Sản phẩm/Biến thể/ảnh và lifecycle; gọi `AdminProductService`, `AdminProductImageService`, các DTO, authorization.                                                    |
| `src/modules/catalog/product/controllers/storefront/product.controller.ts`             | `ProductController`: public list/detail theo slug hoặc UUID và variant routes; `GET /products/slug/:slug` phân biệt với `GET /products/:id`; gọi `ProductService`.                                          |
| `src/modules/catalog/product/domain/product.constants.ts`                              | `SKU_PATTERN`, `VARIANT_INCLUDE`: quy tắc SKU và include/options Prisma cho Biến thể.                                                                                                                       |
| `src/modules/catalog/product/domain/product-image.constants.ts`                        | `IMAGE_CONTENT_TYPES`, `IMAGE_FORMATS`, `IMAGE_MAX_BYTES`, `imageKeyPrefix`, `isImageKeyOf`: giới hạn và kiểm storage key ảnh.                                                                              |
| `src/modules/catalog/product/domain/product-search.query.ts`                           | `productSearchSql`: raw SQL filter/sort/count danh sách, giá khuyến mãi, search không phân biệt dấu; dùng Prisma SQL, query DTO và Gender.                                                                  |
| `src/modules/catalog/product/dto/admin/admin-list-products-query.dto.ts`               | `AdminListProductsQueryDto`: lọc/phân trang back-office theo category/status/query.                                                                                                                         |
| `src/modules/catalog/product/dto/admin/create-image.dto.ts`                            | `CreateImageDto`: dữ liệu gắn ảnh đã upload.                                                                                                                                                                |
| `src/modules/catalog/product/dto/admin/create-product.dto.ts`                          | `CreateProductDto`: input sản phẩm mới, enum Prisma và validation.                                                                                                                                          |
| `src/modules/catalog/product/dto/admin/create-variant.dto.ts`                          | `CreateVariantDto`: input tạo Biến thể, dùng quy tắc SKU.                                                                                                                                                   |
| `src/modules/catalog/product/dto/admin/paginated-product-response.dto.ts`              | `PaginatedProductResponseDto`: response danh sách admin có pagination metadata.                                                                                                                             |
| `src/modules/catalog/product/dto/admin/presigned-image-upload-response.dto.ts`         | `PresignedImageUploadResponseDto`: response upload trực tiếp dùng chung product/category.                                                                                                                   |
| `src/modules/catalog/product/dto/admin/presign-image.dto.ts`                           | `PresignImageDto`: input xin URL upload, kiểm content type/key rules.                                                                                                                                       |
| `src/modules/catalog/product/dto/admin/product-detail-response.dto.ts`                 | `ProductDetailResponseDto`: response admin chi tiết, ghép product, variant và image DTO.                                                                                                                    |
| `src/modules/catalog/product/dto/admin/update-image.dto.ts`                            | `UpdateImageDto`: input sửa metadata ảnh, mở rộng `CreateImageDto`.                                                                                                                                         |
| `src/modules/catalog/product/dto/admin/update-product.dto.ts`                          | `UpdateProductDto`: input cập nhật product/status, dùng enum Prisma và create DTO.                                                                                                                          |
| `src/modules/catalog/product/dto/admin/update-variant.dto.ts`                          | `UpdateVariantDto`: input cập nhật Biến thể, gồm enum/status Prisma.                                                                                                                                        |
| `src/modules/catalog/product/dto/shared/image-response.dto.ts`                         | `ImageResponseDto`: schema ảnh trả về.                                                                                                                                                                      |
| `src/modules/catalog/product/dto/shared/product-response.dto.ts`                       | `ProductResponseDto`: schema product dùng chung, trạng thái Prisma.                                                                                                                                         |
| `src/modules/catalog/product/dto/shared/variant-response.dto.ts`                       | `VariantResponseDto`: response Biến thể, gồm Size/Bảng màu tóm tắt.                                                                                                                                         |
| `src/modules/catalog/product/dto/storefront/list-products-query.dto.ts`                | `PRODUCT_SORTS`, `ProductSort`, `ListProductsQueryDto`: filter/sort storefront, pagination và enum Prisma.                                                                                                  |
| `src/modules/catalog/product/dto/storefront/paginated-product-list-response.dto.ts`    | `PaginatedProductListResponseDto`: response trang danh sách với item storefront.                                                                                                                            |
| `src/modules/catalog/product/dto/storefront/paginated-variant-response.dto.ts`         | `PaginatedVariantResponseDto`: response trang Biến thể storefront.                                                                                                                                          |
| `src/modules/catalog/product/dto/storefront/product-list-item-response.dto.ts`         | `ProductListItemResponseDto`: item danh sách, mở rộng product response với giá tổng hợp.                                                                                                                    |
| `src/modules/catalog/product/dto/storefront/storefront-product-detail-response.dto.ts` | `ActiveSalePriceDto`, `StorefrontVariantResponseDto`, `StorefrontProductDetailResponseDto`: chi tiết public có effective/sale price, ảnh và variant.                                                        |
| `src/modules/catalog/product/mappers/shared/product-image.mapper.ts`                   | `toImageResponse`: map ảnh DB và URL công khai từ `CloudinaryClient`.                                                                                                                                       |
| `src/modules/catalog/product/mappers/shared/variant-response.mapper.ts`                | `VariantWithOptions`, `toVariantResponse`: map Biến thể cùng Size/Bảng màu từ Prisma.                                                                                                                       |
| `src/modules/catalog/product/services/admin/admin-product-image.service.ts`            | `AdminProductImageService`: presign, kiểm chứng/gắn/sửa/xóa ảnh và storage best-effort; Prisma, Cloudinary, mapper/DTO.                                                                                     |
| `src/modules/catalog/product/services/admin/admin-product.service.ts`                  | `ProductDetail`, `AdminProductService`: CRUD, trạng thái, slug, variant và tạo inventory row; Prisma, storage, pagination, mapper; gọi trực tiếp `lockVariants`/`assertPriceAboveSalePrices` trong pricing. |
| `src/modules/catalog/product/services/storefront/product.service.ts`                   | `ProductService`: public list/detail/variants, lọc category visibility, ảnh và effective price; phụ thuộc category tree, raw query, Prisma, Cloudinary và helper sale-price.                                |

#### Product option

| File                                                                                      | Trách nhiệm, symbol chính và phụ thuộc đáng kể                                                                |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `src/modules/catalog/product-option/controllers/admin/admin-product-option.controller.ts` | `AdminProductOptionController`: admin list/create/update Size/Bảng màu; permission và `ProductOptionService`. |
| `src/modules/catalog/product-option/controllers/storefront/product-option.controller.ts`  | `ProductOptionController`: public `GET /sizes`, `/colors`, chỉ mục không ẩn.                                  |
| `src/modules/catalog/product-option/decorators/option-code.decorator.ts`                  | `IsOptionCode`: validator dùng lại cho mã Size/Bảng màu.                                                      |
| `src/modules/catalog/product-option/dto/admin/create-color.dto.ts`                        | `CreateColorDto`: input tạo Bảng màu, dùng `IsOptionCode` và validation.                                      |
| `src/modules/catalog/product-option/dto/admin/create-size.dto.ts`                         | `CreateSizeDto`: input tạo Size, dùng `IsOptionCode` và validation.                                           |
| `src/modules/catalog/product-option/dto/admin/update-color.dto.ts`                        | `UpdateColorDto`: input sửa Bảng màu, mở rộng create DTO.                                                     |
| `src/modules/catalog/product-option/dto/admin/update-size.dto.ts`                         | `UpdateSizeDto`: input sửa Size, mở rộng create DTO.                                                          |
| `src/modules/catalog/product-option/dto/shared/color-response.dto.ts`                     | `ColorResponseDto`: response Bảng màu.                                                                        |
| `src/modules/catalog/product-option/dto/shared/option-summary.dto.ts`                     | `SizeSummaryDto`, `ColorSummaryDto`: dạng tóm tắt nhúng trong variant.                                        |
| `src/modules/catalog/product-option/dto/shared/size-response.dto.ts`                      | `SizeResponseDto`: response Size.                                                                             |
| `src/modules/catalog/product-option/services/shared/product-option.service.ts`            | `ProductOptionService`: list/create/update Size/Bảng màu; Prisma, DTO và Prisma unique-error mapping.         |

#### Test inventory

Các file dưới đây là unit/integration spec trong module và e2e thuộc đúng các thư mục catalog đã thống nhất; không bao gồm test identity hoặc test cross-cutting ngoài scope.

| File test                                                                            | Mục đích được kiểm chứng                                                                           |
| ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| `src/modules/catalog/category/infrastructure/integrations/translation/category-translation.client.spec.ts`           | Gọi dịch khi có credential; dịch Việt→Anh; không lộ lỗi provider/credential.                       |
| `src/modules/catalog/category/domain/category-tree.spec.ts`                          | Dựng cây có thứ tự, loại nhánh ẩn và xử lý ancestor thiếu/vòng lặp an toàn.                        |
| `src/modules/catalog/category/dto/admin/category/create-category.dto.spec.ts`                 | Validation tên bắt buộc, độ dài, trim và description tùy chọn.                                     |
| `src/modules/catalog/category/dto/admin/category/update-category.dto.spec.ts`                 | Validation patch tùy chọn, trim và từ chối tên null/rỗng.                                          |
| `src/modules/catalog/category/application/services/admin/image/admin-category-image.service.spec.ts`   | Chỉ trả URL sau xác minh ảnh; xóa slot không phụ thuộc storage; thiếu category không được presign. |
| `src/modules/catalog/category/application/services/admin/category/admin-category.service.spec.ts`         | CRUD/slug/phân trang, bất biến cây, concurrency và vòng đời bản dịch/xóa.                          |
| `src/modules/catalog/category/application/services/shared/translation/category-translation.service.spec.ts`  | Worker xử lý PENDING, lease/hết lease, thiếu credential, lỗi và retry rõ ràng.                     |
| `src/modules/catalog/category/application/services/storefront/category/category.service.spec.ts`          | Cây/chi tiết chỉ hiện category visible, truy vấn cây và nội dung Anh giữ identity/slug.            |
| `src/modules/catalog/product/dto/admin/admin-list-products-query.dto.spec.ts`        | Mặc định phân trang và validation UUID/status của query admin.                                     |
| `src/modules/catalog/product/dto/admin/create-product.dto.spec.ts`                   | Validation tên, category UUID và dữ liệu tạo sản phẩm.                                             |
| `src/modules/catalog/product/dto/admin/update-product.dto.spec.ts`                   | Validation patch, trim, null và enum trạng thái.                                                   |
| `src/modules/catalog/product-option/services/shared/product-option.service.spec.ts`  | Ẩn/hiện option theo audience, chuẩn hóa hex, duplicate code và patch Size.                         |
| `src/modules/catalog/product/services/admin/admin-product-image.service.spec.ts`     | Primary theo màu, xử lý collision và giới hạn ảnh theo product/color.                              |
| `src/modules/catalog/product/services/admin/admin-product.service-lifecycle.spec.ts` | Publish/archive, lọc admin, tạo inventory cùng variant và quy tắc variant/SKU.                     |
| `src/modules/catalog/product/services/admin/admin-product.service.spec.ts`           | Tạo/đọc/sửa product, slug, category tồn tại và lỗi xung đột.                                       |
| `src/modules/catalog/product/services/storefront/product.service.spec.ts`            | Chỉ đọc product/variant ACTIVE; mapping variant và 404 khi ẩn/không thuộc product.                 |
| `test/admin/catalog/admin-sizes-colors.e2e-spec.ts`                                  | CRUD Size/Bảng màu qua API, quyền STAFF/ADMIN, hidden options, mã và FREESIZE.                     |
| `test/admin/catalog/categories.e2e-spec.ts`                                          | Admin tree/move/list, quyền, kiểm tra cycle và xóa category theo ADR 0001.                         |
| `test/admin/catalog/products.e2e-spec.ts`                                            | Admin product/variant/image lifecycle, validation, quyền, SKU/option và inventory row.             |
| `test/shared/catalog/categories.e2e-spec.ts`                                         | Contract category giữa audience: quyền/validation, locale, ảnh, translation và move đồng thời.     |
| `test/shared/catalog/products.e2e-spec.ts`                                           | Không có hard-delete route và FK RESTRICT khi product còn variant.                                 |
| `test/storefront/catalog/categories.e2e-spec.ts`                                     | Public tree thứ tự ổn định và ẩn toàn bộ nhánh khi ancestor bị ẩn.                                 |
| `test/storefront/catalog/products.e2e-spec.ts`                                       | Public visibility, variant/ảnh, option/filter và lọc category descendants/hidden ancestors.        |
| `test/system/catalog/category-locale-migration.e2e-spec.ts`                          | Migration locale giữ editorial state tiếng Anh cũ và identity category.                            |

### Target so với hiện tại

| Chủ đề                            | Target trong tài liệu                                                                                          | Hiện trạng quan sát được                                                                                                                       |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Đường dẫn chi tiết theo slug      | `GET /products/slug/:slug` (đã theo quyết định issue 03; segment tường minh phân biệt UUID route).             | Đúng như target; đồng thời có `GET /products/:id` và các route đọc variant riêng.                                                              |
| Availability và interface catalog | Target mô tả hỏi `inventory` và các interface `getSellableVariants`, `assertVariantSellable`, `markSkuLocked`. | Các interface đó không được export/đăng ký trong module hiện tại. Product detail/list không đọc Tồn kho; tạo Biến thể chỉ ghi inventory row 0. |
| Media                             | Target ghi upload object storage.                                                                              | Product/category upload được presign và kiểm chứng qua `CloudinaryClient`; khác biệt provider/runtime được thể hiện trong service.             |
| Phạm vi category                  | Target mô tả CRUD và locale mức cơ bản.                                                                        | Có thêm category translations worker, quản lý locale và ảnh thumbnail/banner, với các route liệt kê ở trên.                                    |
