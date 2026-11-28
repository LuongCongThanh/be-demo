# Bản đồ chuyển đổi cho từng module

Type: grilling
Status: resolved

## Question

Theo kiến trúc chung đã chốt ở [Bộ tài liệu chuẩn cho toàn src](./01-canonical-standard-documents.md) (ADR 0015, bộ khung A'), mỗi module hiện có (catalog/category, catalog/product, catalog/product-option, catalog/pricing, identity với auth/access/internal-account, voucher, cart, inventory, checkout) chuyển sang hình dạng đích nào: có những Persistence Port nào (một port mỗi module hay chia theo aggregate, ví dụ Category đang có 3 token), Port nào cho I/O khác (storage, mail, provider), có thư mục `domain/` không và chứa gì, bề mặt nào (`admin/`, `storefront/`), và có tách Core/Admin/Storefront Nest module theo quy tắc có điều kiện không? Bao gồm phần Identity: `access.service.ts` và `internal-account.service.ts` ở root, `auth/strategies/jwt.strategy.ts` gọi Prisma trực tiếp; và Category: gom `admin/application/*`, `storefront/application/*` về `application/`.

## Answer

Chốt qua grilling ngày 2026-11-24 (người dùng đồng ý toàn bộ khuyến nghị sau khi được giải thích bằng ví dụ từ code).

**Quy tắc chung cho mọi module:**

1. **Persistence Port:** mặc định mỗi module (mỗi feature với `catalog`) có **một** Persistence Port gom mọi đọc/ghi các bảng nó sở hữu; chỉ tách khi port phục vụ các nhóm use case không liên quan. Category giữ các port đã tách.
2. **Token DI:** dùng `abstract class` làm cả kiểu lẫn token (`constructor(private readonly carts: CartRepository)`, bind `{ provide: CartRepository, useExisting: PrismaCartRepository }`). Không dùng `Symbol` + `interface` + `@Inject`. Category đổi 6 token hiện có theo.
3. **I/O ngoài DB:** Mail, Storage, AuditLog mỗi thứ có **một port dùng chung** đặt cạnh code hạ tầng (ví dụ `src/infrastructure/mail/mail.port.ts`); module không tự bọc lại. I/O riêng của một module (Google `OAuth2Client` của identity) có port trong `application/ports/` của module đó. Thư viện tính toán thuần không gọi mạng (`JwtService` ký token) không cần port. Port `CategoryImageStorage` và việc product gọi thẳng `CloudinaryClient` chuyển sang port Storage dùng chung (giữ phần riêng của Category nếu port đó có thêm hành vi thật).
4. **`presentation/`** ở gốc feature chứa thành phần HTTP dùng cho cả hai bề mặt: strategy, interceptor, DTO dùng chung khi cùng ý nghĩa. Bổ sung vào bộ khung A'.
5. **Kiểu dữ liệu qua Port:** mỗi feature khai báo Domain Model bằng `type`/`interface` thuần trong `domain/`, chỉ gồm field use case dùng; adapter chuyển từ kiểu Prisma sang. Không dùng class có hành vi.
6. **Nest module:** chỉ Category giữ Core/Admin/Storefront module; mọi module khác một file `*.module.ts`; product, product-option, pricing tiếp tục nằm trong `CatalogModule`.
7. **Dùng chung giữa các feature cùng module** (ví dụ trong `catalog`): được import `domain/` (hàm thuần, kiểu) và `presentation/` (DTO dùng chung) của feature khác; **không** import `application/`, `ports/`, `infrastructure/` của feature khác; cần dữ liệu DB của feature khác thì gọi service của feature đó.

**Bốn loại thành phần dùng chung trong `src`:**

| Loại                                                            | Nơi đặt                                                                                                | Port                                                                  |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| Tiện ích kỹ thuật thuần (pagination, slug, Swagger, validation) | giữ ở `common/`                                                                                        | Không                                                                 |
| Hạ tầng dùng chung (Prisma, Mail, Storage, Audit)               | giữ ở `infrastructure/`                                                                                | Một port dùng chung cho mỗi capability (trừ Prisma, chỉ adapter dùng) |
| Bảo mật dùng chung (`@Authorize`, guard, `CurrentUser`)         | giữ ở `security/`                                                                                      | Không                                                                 |
| Nghiệp vụ module khác cần                                       | module sở hữu export service công khai (quyết định 04 map cũ); giữa feature cùng module theo quy tắc 7 | Theo ticket 06                                                        |

`common/`, `infrastructure/`, `security/` vẫn không import `modules/`.

**Hình dạng đích từng module** (thư mục chỉ có khi có file):

| Module                    | Persistence Port                              | Port khác                                                | `domain/`                                                                   | Bề mặt                                             | Ghi chú chuyển đổi                                                                                    |
| ------------------------- | --------------------------------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| catalog/category          | giữ các port hiện có, đổi sang abstract class | Storage dùng chung; Translation (provider riêng)         | giữ                                                                         | admin, storefront, presentation                    | gom `admin/application`, `storefront/application` về `application/`; giữ Core/Admin/Storefront module |
| catalog/product           | `ProductRepository` (product, variant, image) | Storage dùng chung                                       | model + hằng số, `product-search.query`                                     | admin, storefront, presentation (DTO dùng chung)   | bỏ `services/`, `controllers/`, `mappers/shared` theo bố cục cũ                                       |
| catalog/product-option    | `ProductOptionRepository` (color, size)       | —                                                        | model                                                                       | admin, storefront, presentation (`option-summary`) | service `shared/` về `application/`                                                                   |
| catalog/pricing           | `SalePriceRepository`                         | —                                                        | giữ luật thuần; **query trong `active-sale-prices.ts` chuyển sang adapter** | admin                                              | phần cart dùng qua service công khai (ticket 06)                                                      |
| identity/auth             | port cho user/token/address của auth          | Mail dùng chung, Google verifier riêng, Audit dùng chung | model                                                                       | storefront, presentation (`jwt.strategy`)          | `jwt.strategy` gọi service/port thay vì Prisma                                                        |
| identity/access           | `RoleRepository`                              | Audit dùng chung                                         | model                                                                       | admin                                              | `access.service.ts` ở root vào `access/application/`                                                  |
| identity/internal-account | port cho Staff account                        | Mail, Audit dùng chung                                   | model                                                                       | admin                                              | `internal-account.service.ts` ở root vào `internal-account/application/`                              |
| voucher                   | `VoucherRepository`                           | —                                                        | giữ `voucher-status` + model                                                | admin                                              | —                                                                                                     |
| cart                      | `CartRepository` (cart, cartItem)             | —                                                        | model                                                                       | storefront                                         | từ dạng phẳng sang bộ khung; đọc variant/giá qua service công khai (ticket 06)                        |
| inventory                 | `InventoryRepository`                         | —                                                        | model                                                                       | admin                                              | từ dạng phẳng sang bộ khung                                                                           |
| checkout                  | port cho quote, idempotency key, order        | —                                                        | giữ `checkout-pricing`                                                      | storefront                                         | tách service theo ticket 07; ghi bảng module khác theo ticket 06                                      |

Minh họa cây đích của `catalog`: [assets/02-catalog-target-tree.md](../assets/02-catalog-target-tree.md).
Minh họa cây đích của toàn `src/modules`: [assets/02-src-modules-target-tree.md](../assets/02-src-modules-target-tree.md).

### Bổ sung 2026-11-27

Quy tắc 7: feature X được import đúng một file của feature Y cùng module là `application/<y>.service.ts`; vẫn cấm `ports/`, `infrastructure/` và file `application/` khác, và luật lint 6 chỉ cho phép đúng file đó.
