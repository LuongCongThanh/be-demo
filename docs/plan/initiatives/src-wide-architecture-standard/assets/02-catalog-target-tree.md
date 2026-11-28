# Minh họa: cây đích của `catalog`

Minh họa cho [Bản đồ chuyển đổi cho từng module](../issues/02-layered-structure-criteria.md), dựng ngày 2026-11-24 từ code hiện tại. Đây là hình dung, chưa phải kế hoạch triển khai: thứ tự và ranh giới PR chốt ở [Chia việc triển khai thành task](../issues/09-implementation-task-breakdown.md). Phải đối chiếu lại với code khi bắt đầu task.

## Hiện tại

97 file (chưa tính 22 spec); 51 lệnh Prisma nằm trong service (`admin-product.service.ts` 19, `product.service.ts` 10, `admin-sale-price.service.ts` 8, `admin-product-image.service.ts` 7, `product-option.service.ts` 7).

```text
catalog/
├── category/        ← đã nhiều tầng (domain/application/infrastructure/admin/storefront)
├── product/         ← controllers/admin|storefront, services/admin|storefront, dto/..., mappers/shared, domain/
├── product-option/  ← controllers/..., services/shared, dto/..., decorators/
├── pricing/         ← controllers/admin, services/admin, dto/admin, domain/
└── catalog.module.ts
```

## Đích

```text
catalog/
├── catalog.module.ts                     ← wiring cổng → adapter cho product, option, pricing; export CatalogService
├── application/catalog.service.ts        ← class công khai cho module khác (cart, checkout); nội dung theo ticket 06
│
├── product/
│   ├── domain/
│   │   ├── product.model.ts              ← MỚI: type Product, ProductVariant, ProductImage
│   │   ├── product.constants.ts
│   │   └── product-image.constants.ts
│   ├── application/
│   │   ├── ports/product.repository.ts   ← MỚI: abstract class
│   │   ├── product.service.ts            ← từ services/storefront
│   │   ├── admin-product.service.ts      ← từ services/admin
│   │   └── admin-product-image.service.ts← dùng port Storage dùng chung thay CloudinaryClient
│   ├── infrastructure/
│   │   ├── prisma-product.repository.ts  ← MỚI: nhận query Prisma từ service
│   │   └── product-search.query.ts       ← CHUYỂN từ domain/ (dựng SQL, không phải luật thuần)
│   ├── presentation/                     ← DTO + mapper dùng chung hai bề mặt (từ dto/shared, mappers/shared)
│   ├── admin/      controllers/  dto/
│   └── storefront/ controllers/  dto/
│
├── product-option/
│   ├── domain/product-option.model.ts    ← MỚI: type Color, Size
│   ├── application/
│   │   ├── ports/product-option.repository.ts
│   │   └── product-option.service.ts     ← từ services/shared
│   ├── infrastructure/prisma-product-option.repository.ts
│   ├── presentation/                     ← option-summary.dto (product dùng được theo quy tắc 7)
│   ├── admin/      controllers/  dto/  decorators/option-code.decorator.ts
│   └── storefront/ controllers/
│
├── pricing/
│   ├── domain/
│   │   ├── sale-price.model.ts           ← MỚI
│   │   ├── sale-price-guards.ts
│   │   └── sale-price-status.ts          ← active-sale-prices.ts không còn ở đây
│   ├── application/
│   │   ├── ports/sale-price.repository.ts
│   │   └── admin-sale-price.service.ts
│   ├── infrastructure/prisma-sale-price.repository.ts  ← nhận query của active-sale-prices.ts
│   └── admin/      controllers/  dto/
│
└── category/
    ├── application/                      ← gom admin/application/* + storefront/application/*
    │   ├── ports/                        ← token Symbol → abstract class; bỏ port storage riêng nếu chỉ bọc lại
    │   └── ...
    ├── domain/  infrastructure/  presentation/  testing/   (giữ)
    ├── admin/      controllers/  dto/  mappers/
    ├── storefront/ controllers/  dto/  mappers/
    └── category-core / admin / storefront / category .module.ts (giữ)
```

## Thay đổi chính

| Hiện tại                                                             | Đích                                         |
| -------------------------------------------------------------------- | -------------------------------------------- |
| 4 feature, 3 kiểu xếp thư mục                                        | Một bộ khung chung                           |
| 51 lệnh Prisma trong service                                         | Gom vào 3 adapter `prisma-*.repository.ts`   |
| `product/domain/product-search.query.ts` dựng SQL                    | Chuyển sang `infrastructure/`                |
| `pricing/domain/active-sale-prices.ts` gọi Prisma, cart import thẳng | Query vào adapter; cart gọi `CatalogService` |
| Product gọi `CloudinaryClient`, Category bọc port riêng              | Cùng dùng port Storage dùng chung            |
| Category có 2 `application/` + `application/shared/`                 | Một `application/`                           |

Chi phí ước lượng: khoảng 8–10 file mới (3 port, 3 adapter, 3 model, `catalog.service.ts`); route, Swagger và response không đổi.

## Phụ thuộc ticket chưa chốt

- Ghi nhiều bảng trong một transaction (tạo product kèm variant và inventory): [Hợp đồng transaction trong và giữa các module](../issues/05-transaction-contract.md).
- Hàm của `CatalogService`: [Ownership dữ liệu cho cart và checkout](../issues/06-cart-checkout-ownership.md).
- Ném `NotFoundException` hay lỗi nghiệp vụ: [Chiến lược xử lý lỗi toàn src](../issues/03-error-handling-strategy.md).
