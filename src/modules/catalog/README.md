# Catalog module

Tài liệu này mô tả cây thư mục và trách nhiệm chính của từng thành phần trong module `catalog`.

## Sơ đồ tổng quan

```text
catalog/
├── category/        CategoryModule: Danh mục, cây, locale, ảnh và bản dịch
│   ├── category.module.ts
│   ├── domain/
│   ├── application/   services/ và ports/
│   ├── controllers/
│   ├── dto/
│   ├── presentation/
│   ├── infrastructure/
│   └── testing/
├── product/         Sản phẩm, biến thể, ảnh và truy vấn storefront
├── product-option/  Kích cỡ và màu sắc dùng cho biến thể
├── pricing/         Giá khuyến mãi của biến thể
└── catalog.module.ts Composition root; import CategoryModule
```

Với Category: Controller → Application Service → Domain/Port → Infrastructure Adapter; Controller chuyển Application Result thành DTO qua Presentation Mapper. Các feature Catalog khác giữ cách tổ chức hiện tại.

## Thư mục và file

### Module gốc

- [`catalog.module.ts`](./catalog.module.ts) — composition root cho product, product-option và pricing; import `CategoryModule`.

### `category/`

`CategoryModule` là composition root riêng theo [module-architecture-conventions.md](../../../docs/conventions/module-architecture-conventions.md) (Category tách Core/Admin/Storefront Nest module); `CatalogModule` chỉ import module này. Không có dependency từ Domain/Application tới Prisma, HTTP DTO, Cloudinary hoặc provider translation.

#### Domain

- [`category.module.ts`](./category/category.module.ts) — wiring controller, application providers và token-to-adapter bindings.
- [`category.model.ts`](./category/domain/models/category.model.ts) — domain model cho danh mục, bản dịch và locale.
- [`category-tree.ts`](./category/domain/tree/category-tree.ts) — dựng cây hiển thị và kiểm tra visibility thuần, không phụ thuộc DTO/Prisma.
- `domain/localization/`, `domain/image/`, `domain/errors/` — locale, quy tắc ảnh và lỗi nghiệp vụ.

#### Application

- [`category.repository.ts`](./category/application/ports/persistence/category.repository.ts) — persistence ports và kiểu dữ liệu thuộc Application.
- `application/ports/storage/` và `application/ports/translation/` — hợp đồng ảnh, dịch thuật và worker dịch.
- `application/services/admin/` — category, image và translation use cases; `shared/` — localization và worker; `storefront/category/` — truy vấn danh mục công khai.

#### HTTP và Presentation

- `controllers/admin/` và `controllers/storefront/` là HTTP adapters.
- `dto/admin/` chia theo category, image và localization; `dto/shared/` và `dto/storefront/` giữ hợp đồng response/query.
- [`admin category-response.mapper.ts`](./category/admin/presentation/mappers/category-response.mapper.ts) và
  [`storefront category-response.mapper.ts`](./category/storefront/presentation/mappers/category-response.mapper.ts)
  chuyển Application/Domain result thành response DTO.

#### Infrastructure và Testing

- `infrastructure/persistence/relational/queries/` chứa Prisma selects; `adapters/` hiện thực persistence ports; module persistence export concrete adapter để `CategoryModule` bind token.
- `infrastructure/integrations/translation/` hiện thực translation port; `infrastructure/storage/` nối storage dùng chung với category image port.
- [`category-test-setup.ts`](./category/testing/category-test-setup.ts) là helper dùng chung. Test riêng đặt cạnh thành phần được kiểm thử.

### `product/`

Nghiệp vụ sản phẩm, biến thể và ảnh. Trong cấu trúc hiện tại, service truy cập Prisma trực tiếp, không có repository riêng.

#### `product/controllers/`

- `admin/`
  - [`admin-product.controller.ts`](./product/controllers/admin/admin-product.controller.ts) — API quản trị sản phẩm, biến thể và trạng thái sản phẩm.
- `storefront/`
  - [`product.controller.ts`](./product/controllers/storefront/product.controller.ts) — API công khai tìm/xem sản phẩm và biến thể.

#### `product/domain/`

- [`product.constants.ts`](./product/domain/product.constants.ts) — mẫu SKU và cấu hình quan hệ cần include khi truy vấn biến thể.
- [`product-image.constants.ts`](./product/domain/product-image.constants.ts) — định dạng/kích thước ảnh, tiền tố storage và kiểm tra key ảnh thuộc sản phẩm.
- [`product-search.query.ts`](./product/domain/product-search.query.ts) — dựng truy vấn tìm kiếm, lọc và sắp xếp sản phẩm storefront.

#### `product/dto/`

Các kiểu dữ liệu và xác thực API sản phẩm.

- `admin/`
  - [`admin-list-products-query.dto.ts`](./product/dto/admin/admin-list-products-query.dto.ts) — query lọc, tìm kiếm và phân trang danh sách admin.
  - [`admin-list-products-query.dto.spec.ts`](./product/dto/admin/admin-list-products-query.dto.spec.ts) — kiểm thử query DTO danh sách admin.
  - [`create-image.dto.ts`](./product/dto/admin/create-image.dto.ts) — dữ liệu thêm ảnh sản phẩm.
  - [`create-product.dto.ts`](./product/dto/admin/create-product.dto.ts) — dữ liệu tạo sản phẩm.
  - [`create-product.dto.spec.ts`](./product/dto/admin/create-product.dto.spec.ts) — kiểm thử DTO tạo sản phẩm.
  - [`create-variant.dto.ts`](./product/dto/admin/create-variant.dto.ts) — dữ liệu tạo biến thể.
  - [`paginated-product-response.dto.ts`](./product/dto/admin/paginated-product-response.dto.ts) — response danh sách sản phẩm admin có phân trang.
  - [`presign-image.dto.ts`](./product/dto/admin/presign-image.dto.ts) — dữ liệu yêu cầu URL tải ảnh được ký trước.
  - [`presigned-image-upload-response.dto.ts`](./product/dto/admin/presigned-image-upload-response.dto.ts) — response thông tin tải ảnh được ký.
  - [`product-detail-response.dto.ts`](./product/dto/admin/product-detail-response.dto.ts) — response chi tiết sản phẩm cho admin.
  - [`update-image.dto.ts`](./product/dto/admin/update-image.dto.ts) — dữ liệu cập nhật ảnh.
  - [`update-product.dto.ts`](./product/dto/admin/update-product.dto.ts) — dữ liệu cập nhật sản phẩm.
  - [`update-product.dto.spec.ts`](./product/dto/admin/update-product.dto.spec.ts) — kiểm thử DTO cập nhật sản phẩm.
  - [`update-variant.dto.ts`](./product/dto/admin/update-variant.dto.ts) — dữ liệu cập nhật biến thể.
- `shared/`
  - [`image-response.dto.ts`](./product/dto/shared/image-response.dto.ts) — cấu trúc response ảnh.
  - [`product-response.dto.ts`](./product/dto/shared/product-response.dto.ts) — cấu trúc response sản phẩm dùng chung.
  - [`variant-response.dto.ts`](./product/dto/shared/variant-response.dto.ts) — cấu trúc response biến thể.
- `storefront/`
  - [`list-products-query.dto.ts`](./product/dto/storefront/list-products-query.dto.ts) — query lọc/tìm kiếm/sắp xếp sản phẩm công khai.
  - [`paginated-product-list-response.dto.ts`](./product/dto/storefront/paginated-product-list-response.dto.ts) — response danh sách sản phẩm có phân trang.
  - [`paginated-variant-response.dto.ts`](./product/dto/storefront/paginated-variant-response.dto.ts) — response danh sách biến thể có phân trang.
  - [`product-list-item-response.dto.ts`](./product/dto/storefront/product-list-item-response.dto.ts) — cấu trúc sản phẩm ở dạng thẻ/list item.
  - [`storefront-product-detail-response.dto.ts`](./product/dto/storefront/storefront-product-detail-response.dto.ts) — response chi tiết sản phẩm và giá hiệu lực/giá khuyến mãi.

#### `product/mappers/shared/`

- [`product-image.mapper.ts`](./product/mappers/shared/product-image.mapper.ts) — chuyển ảnh sản phẩm thành DTO, gồm URL công khai từ storage.
- [`variant-response.mapper.ts`](./product/mappers/shared/variant-response.mapper.ts) — chuyển bản ghi biến thể Prisma thành DTO response.

#### `product/services/`

- `admin/`
  - [`admin-product-image.service.ts`](./product/services/admin/admin-product-image.service.ts) — nghiệp vụ quản trị ảnh sản phẩm và tích hợp storage.
  - [`admin-product-image.service.spec.ts`](./product/services/admin/admin-product-image.service.spec.ts) — kiểm thử nghiệp vụ ảnh sản phẩm.
  - [`admin-product.service.ts`](./product/services/admin/admin-product.service.ts) — tạo/sửa/liệt kê/archive sản phẩm; quản lý biến thể và kiểm tra liên quan giá khuyến mãi.
  - [`admin-product.service.spec.ts`](./product/services/admin/admin-product.service.spec.ts) — kiểm thử service sản phẩm admin.
  - [`admin-product.service-lifecycle.spec.ts`](./product/services/admin/admin-product.service-lifecycle.spec.ts) — kiểm thử chuyển trạng thái sản phẩm và quy tắc biến thể.
- `storefront/`
  - [`product.service.ts`](./product/services/storefront/product.service.ts) — tìm/xem sản phẩm và biến thể công khai; chỉ trả dữ liệu đang hoạt động và tính giá hiệu lực.
  - [`product.service.spec.ts`](./product/services/storefront/product.service.spec.ts) — kiểm thử nghiệp vụ product storefront.

### `product-option/`

Quản lý các lựa chọn dùng cho biến thể, hiện gồm kích cỡ và màu sắc.

- `controllers/admin/`
  - [`admin-product-option.controller.ts`](./product-option/controllers/admin/admin-product-option.controller.ts) — API quản trị tạo/sửa/ẩn kích cỡ và màu.
- `controllers/storefront/`
  - [`product-option.controller.ts`](./product-option/controllers/storefront/product-option.controller.ts) — API công khai đọc các lựa chọn có thể hiển thị.
- `decorators/`
  - [`option-code.decorator.ts`](./product-option/decorators/option-code.decorator.ts) — decorator xác thực mã option dùng chung.
- `dto/admin/`
  - [`create-color.dto.ts`](./product-option/dto/admin/create-color.dto.ts) — dữ liệu tạo màu.
  - [`create-size.dto.ts`](./product-option/dto/admin/create-size.dto.ts) — dữ liệu tạo kích cỡ.
  - [`update-color.dto.ts`](./product-option/dto/admin/update-color.dto.ts) — dữ liệu cập nhật màu.
  - [`update-size.dto.ts`](./product-option/dto/admin/update-size.dto.ts) — dữ liệu cập nhật kích cỡ.
- `dto/shared/`
  - [`color-response.dto.ts`](./product-option/dto/shared/color-response.dto.ts) — response màu.
  - [`option-summary.dto.ts`](./product-option/dto/shared/option-summary.dto.ts) — cấu trúc tóm tắt option dùng trong response khác.
  - [`size-response.dto.ts`](./product-option/dto/shared/size-response.dto.ts) — response kích cỡ.
- `services/shared/`
  - [`product-option.service.ts`](./product-option/services/shared/product-option.service.ts) — nghiệp vụ đọc và quản lý option kích cỡ/màu.
  - [`product-option.service.spec.ts`](./product-option/services/shared/product-option.service.spec.ts) — kiểm thử service option.

### `pricing/`

Quản lý giá khuyến mãi áp dụng cho biến thể; các quy tắc giá nằm trong domain và API quản trị ở controller/service.

- `controllers/admin/`
  - [`admin-sale-price.controller.ts`](./pricing/controllers/admin/admin-sale-price.controller.ts) — API quản trị tạo, xem, sửa, kết thúc và xóa giá khuyến mãi.
- `domain/`
  - [`active-sale-prices.ts`](./pricing/domain/active-sale-prices.ts) — truy xuất giá khuyến mãi đang hiệu lực cho các biến thể.
  - [`sale-price-guards.ts`](./pricing/domain/sale-price-guards.ts) — khóa biến thể và guard cho chồng lấn/ràng buộc giá khuyến mãi.
  - [`sale-price-status.ts`](./pricing/domain/sale-price-status.ts) — xác định trạng thái upcoming/active/ended và tính giá sau chiết khấu.
- `dto/admin/`
  - [`create-sale-price.dto.ts`](./pricing/dto/admin/create-sale-price.dto.ts) — dữ liệu tạo giá khuyến mãi.
  - [`sale-price-response.dto.ts`](./pricing/dto/admin/sale-price-response.dto.ts) — cấu trúc response giá khuyến mãi.
  - [`update-sale-price.dto.ts`](./pricing/dto/admin/update-sale-price.dto.ts) — dữ liệu cập nhật giá/thời gian khuyến mãi.
- `services/admin/`
  - [`admin-sale-price.service.ts`](./pricing/services/admin/admin-sale-price.service.ts) — vòng đời giá khuyến mãi; kiểm tra giá, thời hạn và quyền chỉnh sửa theo trạng thái.

## Ghi chú cấu trúc

- Category được tách giữa hợp đồng repository (`category/repositories/`) và adapter Prisma (`category/infrastructure/persistence/relational/`).
- Product và pricing hiện dùng Prisma trực tiếp trong service, không có repository riêng trong cây thư mục này.
- Các file `*.spec.ts` là kiểm thử cho domain, DTO, client hoặc service tương ứng; `category-test-setup.ts` là helper phục vụ test.
