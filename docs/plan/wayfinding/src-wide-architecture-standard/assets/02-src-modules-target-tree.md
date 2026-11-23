# Minh họa: cây đích của toàn `src/modules`

Minh họa cho [Bản đồ chuyển đổi cho từng module](../issues/02-layered-structure-criteria.md), dựng ngày 2026-11-24 từ code hiện tại. Chi tiết `catalog`: [02-catalog-target-tree.md](./02-catalog-target-tree.md). Đây là hình dung, chưa phải kế hoạch triển khai; thứ tự và PR chốt ở [Chia việc triển khai thành task](../issues/09-implementation-task-breakdown.md).

## Tổng quan

| Module    | File (không tính spec) | Lệnh Prisma trong service/strategy                  | Kiểu hiện tại                             |
| --------- | ---------------------- | --------------------------------------------------- | ----------------------------------------- |
| catalog   | 97                     | 51 (product, option, pricing; category đã qua port) | category nhiều tầng, còn lại theo vai trò |
| identity  | 41                     | 78                                                  | theo vai trò; 2 service nằm ở root        |
| voucher   | 9                      | 9                                                   | theo vai trò                              |
| cart      | 4                      | 25                                                  | phẳng                                     |
| inventory | 4                      | 14                                                  | phẳng                                     |
| checkout  | 9                      | 17 (ghi cả bảng của inventory, voucher)             | theo vai trò                              |
| **Tổng**  | **164**                | **~194**                                            |                                           |

Cấp trên cùng không đổi: `src/modules/{catalog,identity,voucher,cart,inventory,checkout}`, mỗi module một composition root. Mọi module bên trong dùng cùng bộ khung `domain/`, `application/` (+ `ports/`), `infrastructure/`, `presentation/`, `admin/`, `storefront/`; thư mục chỉ có khi có file.

## identity

```text
identity/
├── identity.module.ts                    ← wiring port → adapter; export AccessService, InternalAccountService (quyết định 04 map cũ)
├── auth/
│   ├── domain/account.model.ts           ← MỚI: type Account, CustomerAddress, các loại token
│   ├── application/
│   │   ├── ports/
│   │   │   ├── account.repository.ts     ← MỚI: user + customerAddress
│   │   │   ├── auth-token.repository.ts  ← MỚI: refreshToken, emailVerificationToken, passwordResetToken
│   │   │   └── google-identity.verifier.ts ← MỚI: bọc OAuth2Client (I/O riêng của identity)
│   │   ├── session.service.ts  registration.service.ts  password-reset.service.ts
│   │   ├── account-profile.service.ts  token.service.ts  access-claims.service.ts  password.service.ts
│   │   └── send-best-effort.ts           ← từ utils/
│   ├── infrastructure/
│   │   ├── prisma-account.repository.ts  prisma-auth-token.repository.ts
│   │   └── google-identity.verifier.ts   ← adapter OAuth2Client
│   ├── presentation/jwt.strategy.ts      ← dùng cho token Khách hàng lẫn Staff; gọi AccessClaimsService, không gọi Prisma
│   └── storefront/ controllers/ (auth, me)  dto/  guards/email-throttler.guard.ts
├── access/
│   ├── application/
│   │   ├── ports/role.repository.ts      ← MỚI: role, userRole, rolePermission
│   │   └── access.service.ts             ← CHUYỂN từ identity/access.service.ts (21 lệnh Prisma ra adapter)
│   ├── infrastructure/prisma-role.repository.ts
│   └── admin/ controllers/admin-role.controller.ts  dto/
└── internal-account/
    ├── application/
    │   ├── ports/staff-account.repository.ts
    │   └── internal-account.service.ts   ← CHUYỂN từ identity/internal-account.service.ts; spec đang nằm lệch ở services/admin
    ├── infrastructure/prisma-staff-account.repository.ts
    └── admin/ controllers/admin-staff.controller.ts  dto/
```

Mail và AuditLog dùng port dùng chung ở `src/infrastructure/` (MailService, AuditLogService không bị inject trực tiếp nữa). `JwtService` dùng thẳng (tính toán thuần). Chia `auth` thành 2 persistence port là gợi ý theo quy tắc "tách khi phục vụ nhóm use case không liên quan" (tài khoản/địa chỉ so với token); chốt lại khi làm task.

## voucher

```text
voucher/
├── voucher.module.ts
├── domain/  voucher-status.ts  voucher.model.ts (MỚI)
├── application/
│   ├── ports/voucher.repository.ts       ← MỚI
│   └── admin-voucher.service.ts          ← từ services/admin
├── infrastructure/prisma-voucher.repository.ts
└── admin/ controllers/  dto/
```

Phần checkout cần (kiểm tra voucher, ghi nhận sử dụng) đi qua service công khai theo [Ownership dữ liệu cho cart và checkout](../issues/06-cart-checkout-ownership.md).

## cart

```text
cart/
├── cart.module.ts
├── domain/cart.model.ts                  ← MỚI: type Cart, CartItem
├── application/
│   ├── ports/cart.repository.ts          ← MỚI: cart + cartItem
│   └── cart.service.ts                   ← 25 lệnh Prisma ra adapter
├── infrastructure/prisma-cart.repository.ts
└── storefront/ controllers/cart.controller.ts  dto/
```

Đọc `productVariant` và giá khuyến mãi qua `CatalogService`, bỏ import `catalog/pricing/domain/active-sale-prices.js`.

## inventory

```text
inventory/
├── inventory.module.ts                   ← export InventoryService (đã có)
├── domain/inventory.model.ts             ← MỚI
├── application/
│   ├── ports/inventory.repository.ts     ← MỚI: inventory, inventoryMovement, inventoryStockCount
│   └── inventory.service.ts              ← 14 lệnh Prisma ra adapter
├── infrastructure/prisma-inventory.repository.ts
└── admin/ controllers/inventory.controller.ts  dto/
```

`awaitingDispatchItem` (inventory đang đọc, checkout đang ghi): ai sở hữu chốt ở ticket 06.

## checkout

```text
checkout/
├── checkout.module.ts
├── domain/
│   ├── checkout-pricing.ts
│   └── checkout.model.ts                 ← MỚI: type CheckoutQuote, Order
├── application/
│   ├── ports/
│   │   ├── checkout-quote.repository.ts  ← quote + idempotencyKey
│   │   └── order.repository.ts
│   ├── checkout-quote.service.ts         ← tách từ checkout.service.ts (537 dòng)
│   └── place-order.service.ts            ← tách từ checkout.service.ts
├── infrastructure/ prisma-checkout-quote.repository.ts  prisma-order.repository.ts
└── storefront/ controllers/  dto/  guards/optional-customer-auth.guard.ts (từ security/)
```

Cách tách service chốt ở [Cách tách checkout](../issues/07-checkout-structure.md). Việc checkout đang ghi thẳng `inventory`, `voucher`, `voucherUsage` chuyển sang gọi service công khai của Inventory và Voucher theo ticket 06, trong transaction theo ticket 05.

## Phụ thuộc giữa module sau khi đổi

```text
checkout ──> CatalogService (giá, variant)
         ──> VoucherService (kiểm tra, ghi nhận sử dụng)
         ──> InventoryService (trừ/giữ tồn)
         ──> IdentityModule (guard)
cart     ──> CatalogService (variant, giá)
         ──> IdentityModule (guard)
```

Một chiều, không vòng; không module nào import file bên trong module khác hoặc truy cập bảng của module khác bằng Prisma.

## Phụ thuộc ticket chưa chốt

- Transaction trong và giữa module: [Hợp đồng transaction trong và giữa các module](../issues/05-transaction-contract.md).
- Hàm của các service công khai, sở hữu `awaitingDispatchItem`: [Ownership dữ liệu cho cart và checkout](../issues/06-cart-checkout-ownership.md).
- Tách checkout: [Cách tách checkout](../issues/07-checkout-structure.md).
- Ném `NotFoundException` hay lỗi nghiệp vụ: [Chiến lược xử lý lỗi toàn src](../issues/03-error-handling-strategy.md).
