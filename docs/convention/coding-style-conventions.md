# Convention: Coding Style & Naming (ecommerce project)

> 📖 Xem [README.md](README.md) để biết vị trí file này trong toàn bộ convention và thứ tự đọc.

Tài liệu này dành cho **dev trong team tự đọc và tự viết code**. Đọc xong, bạn biết: đặt tên file/class thế nào, khi nào tách file, import kiểu gì, và vì sao 1 vài quyết định ở đây (đặc biệt phần import alias) lại rắc rối hơn bình thường — vì đã thật sự thử và vấp phải bug trước khi chốt.

## 1. Đặt tên file

Kebab-case, hậu tố theo vai trò — đúng pattern đã dùng xuyên suốt `src/`:

| Vai trò    | Hậu tố                           | Ví dụ                        |
| ---------- | -------------------------------- | ---------------------------- |
| Module     | `.module.ts`                     | `auth.module.ts`             |
| Controller | `.controller.ts`                 | `auth.controller.ts`         |
| Service    | `.service.ts`                    | `token.service.ts`           |
| DTO        | `.dto.ts`                        | `create-resource.dto.ts`     |
| Guard      | `.guard.ts`                      | `ownership.guard.ts`         |
| Decorator  | `.decorator.ts`                  | `current-user.decorator.ts`  |
| Strategy   | `.strategy.ts`                   | `jwt.strategy.ts`            |
| Test       | `.spec.ts`                       | `token.service.spec.ts`      |
| E2E test   | `.e2e-spec.ts`                   | `auth-login.e2e-spec.ts`     |
| Mapper     | `.mapper.ts`                     | `variant-response.mapper.ts` |
| Hằng số    | `.constants.ts` / `.constant.ts` | `product.constants.ts`       |
| Enum       | `.enum.ts`                       | `product-sort.enum.ts`       |
| Middleware | `.middleware.ts`                 | `request-id.middleware.ts`   |
| Tiện ích   | `.util.ts`                       | `slug.util.ts`               |

Class bên trong file dùng PascalCase khớp tên file (`token.service.ts` → `TokenService`). Biến/instance dùng camelCase (`private readonly productsService: ProductsService`).

**Vì sao kebab-case cho tên file và thư mục (không dùng `productService/`, `ProductService.ts`)?** Đây là quy ước được ghi lại ở đây, chưa có lint rule ép:

- Theo NestJS: `nest g service product-options` sinh ra `product-options/product-options.service.ts`; style guide chính thức của Nest cũng dùng kebab-case. camelCase chỉ dành cho **tên biến**, PascalCase cho **tên class**.
- Tránh bug phân biệt hoa/thường: Linux (CI, Docker) phân biệt hoa/thường trong đường dẫn còn macOS/Windows thì không — import `productService` vs `ProductService` chạy được ở máy dev nhưng vỡ trên CI. Toàn chữ thường thì không xảy ra.

## 2. Cấu trúc thư mục theo module

Cây `src/` tổng thể và danh sách module nằm ở [02-modules.md §4](../architecture/02-modules.md#4-cấu-trúc-thư-mục); cây đích đầy đủ với ký hiệu K/M/N/D ở `TARGET-REPOSITORY-TREE.md` (file kế hoạch liên repo ở thư mục workspace, ngoài repo này). Phần này là **quy tắc** để biết 1 file mới phải đặt ở đâu. (Sửa 2026-11-13: xếp theo thực thể thay cho thư mục vai trò.)

### 2.1 Gốc module chỉ có `<module>.module.ts` — trừ module nhỏ

Gốc `modules/<module>/` chứa `<module>.module.ts` và các **sub-module theo thực thể**. Ngoại lệ: module chỉ có một thực thể và ≤ ~8 file (`cart/`, `voucher/`, `media/`) để file phẳng ngay cạnh `<module>.module.ts`, không tạo sub-module.

### 2.2 Sub-module theo thực thể, file phẳng bên trong

Trong module nhiều thực thể, mỗi thực thể là một thư mục kebab-case **số ít**, trùng tên resource trên URL ở dạng số ít: `product/`, `category/`, `product-option/`, `pricing/`. Bên trong, mọi file đặt **phẳng** (controller, service, mapper, constants, decorator, spec), chỉ có **một** thư mục con `dto/`:

```text
modules/catalog/product/
├── product.controller.ts              # storefront: /api/v1/products
├── admin-product.controller.ts        # back-office: /api/v1/admin/products
├── product.service.ts
├── admin-product.service.ts
├── admin-product-image.service.ts
├── variant-response.mapper.ts
├── product.constants.ts
├── product.service.spec.ts
└── dto/
    ├── create-product.dto.ts
    └── product-response.dto.ts
```

Không còn các thư mục vai trò `controllers/`, `services/`, `mappers/`, `domain/`, `constants/`, `decorators/`, `guards/`, `strategies/`: vai trò đã nằm trong **hậu tố file** (§1). Lý do đổi: nhìn vào một thư mục là thấy trọn một thực thể từ controller tới DTO, thay vì phải mở 5 thư mục vai trò để ghép lại.

Phân biệt storefront/back-office bằng **tiền tố `admin-`** trong tên file (`admin-product.controller.ts` → route `/api/v1/admin/...`, cần `@Authorize(Permission...)`), không bằng thư mục.

Tên file bên trong vẫn đầy đủ (không rút gọn vì đã có thư mục cha) để tìm file bằng tên (Ctrl+P) không bị trùng: `product.service.ts`, không phải `service.ts`.

Thứ tự ưu tiên khi phân vân hậu tố: có decorator Nest (`@Injectable`) → `.service.ts`; có decorator class-validator/Swagger → `dto/*.dto.ts`; hàm thuần không I/O → không hậu tố nếu là luật nghiệp vụ (`category-tree.ts`, `order-state-machine.ts`), `.mapper.ts` nếu chỉ đổi hình dạng dữ liệu.

### 2.3 Ranh giới giữa module

- Cửa ngõ của module là mảng `exports` trong `<module>.module.ts`. Mỗi module export **đúng một** service public; service ruột không export. Module khác `imports: [XModule]` và inject service đó; **không** import file ruột của module khác theo đường dẫn.
- Interface + token DI chỉ khi có ≥ 2 implementation thật (`PaymentGateway`). Một adapter inject class trực tiếp.
- Transaction xuyên module: module điều phối mở `prisma.$transaction` và truyền `Prisma.TransactionClient` xuống service module khác. Không có lớp bọc transaction riêng.
- `common/` không import `modules/`.

### 2.4 Test

`*.spec.ts` nằm **cạnh** file được test (mặc định của Nest), không tạo `__tests__/`. E2E test nằm ở `test/` gốc repo.

### 2.5 `common/`

`common/` là code dùng chung toàn app, chia theo vai trò, không để file rời:

```text
common/
├── filters/      # all-exceptions.filter.ts
├── middleware/   # request-id.middleware.ts
├── utils/        # slug.util.ts
├── pagination/   # paginate.ts, pagination.dto.ts, pagination-meta.dto.ts
├── swagger/      # api-error-responses.decorator.ts, api-tags.ts, error-response.dto.ts
├── auth/         # authorize.decorator.ts, permissions.guard.ts, permission.enum.ts, jwt-auth.guard.ts, ownership.guard.ts, current-user.decorator.ts
└── validation/   # is-strong-password.decorator.ts
```

Hạ tầng phụ thuộc runtime (Prisma + `prisma-error.util`, health, metrics, logging/AppLogger, mail, audit, storage, payment adapter, shipping, outbox, queue) nằm ở `src/infrastructure/`, không ở `common/`.

### 2.6 Ví dụ hoàn chỉnh: `modules/identity/`

```text
identity/
├── identity.module.ts            # exports: PassportModule, InternalAccountService, AccessService
├── auth/                         # đăng ký, đăng nhập, phiên, mật khẩu, me
│   ├── auth.controller.ts
│   ├── me.controller.ts
│   ├── registration.service.ts
│   ├── session.service.ts
│   ├── password-reset.service.ts
│   ├── account-profile.service.ts
│   ├── token.service.ts
│   ├── password.service.ts
│   ├── jwt.strategy.ts
│   ├── email-throttler.guard.ts
│   └── dto/
├── internal-account/             # Staff/Admin; bất biến luôn còn ≥ 1 Admin active
│   ├── admin-staff.controller.ts
│   ├── internal-account.service.ts
│   └── dto/
└── access/                       # Role, Permission, gán role
    ├── admin-role.controller.ts
    ├── access.service.ts
    └── dto/
```

## 3. Barrel file (`index.ts`) — **cấm**

Không tạo file `index.ts` để re-export gộp nhiều module con. Mọi import phải trỏ thẳng tới file thật (vd. `from './dto/create-resource.dto.js'`, không phải `from './dto/index.js'`).

**Lý do**: project dùng ESM (`"type": "module"`) + NestJS DI dựa trên **class reference làm token**. Barrel file (đặc biệt với vòng phụ thuộc giữa các module) là nguồn gây lỗi kinh điển trong ESM — module load theo thứ tự khác dự kiến, hoặc 1 class bị load 2 lần qua 2 đường (trực tiếp và qua barrel) tạo ra 2 object class khác nhau về mặt tham chiếu, khiến NestJS DI báo "cannot resolve dependency" dù code nhìn thì đúng 100% (xem thêm [§4](#4-import-alias-src--dùng-ở-mọi-nơi) — đây là **chính xác loại bug** đã gặp phải khi thử nghiệm alias, chỉ khác là do 2 specifier khác nhau resolve ra thay vì qua barrel).

## 4. Import alias `#src/*` — dùng ở mọi nơi

Mọi import trỏ vào `src/` dùng alias `#src/*`, kể cả trong cùng thư mục và trong file test. Không dùng relative import (`./`, `../`) tới file trong `src/`. Ngoại lệ: `src/generated/` (Prisma sinh tự động) và import tới `test/support/` từ file e2e.

```ts
// ✓ Đúng — ở bất kỳ đâu (src/, *.spec.ts, test/)
import { PrismaService } from '#src/infrastructure/database/prisma.service.js';

// ✗ Sai
import { PrismaService } from '#src/infrastructure/database/prisma.service.js';
```

Alias là [Node subpath imports](https://nodejs.org/api/packages.html#subpath-imports), khai ở `package.json`:

```json
"imports": {
  "#src/*": { "types": "./src/*", "default": "./dist/*" }
}
```

| Môi trường        | `#src/x.js` resolve tới                                                            |
| ----------------- | ---------------------------------------------------------------------------------- |
| `tsc` / typecheck | `src/x.ts` (điều kiện `types`)                                                     |
| `node dist/main`  | `dist/x.js` (điều kiện `default`)                                                  |
| Vitest            | `src/x.ts` — qua `resolve.alias` trong `vitest.config.ts` / `vitest.config.e2e.ts` |

### Vì sao `#src` mà không phải `@src`

- **`@src/*` (tsconfig `paths`) không chạy được ở runtime.** `tsc` không viết lại `paths` khi build, và Node coi mọi specifier bắt đầu bằng `@` là tên npm package có scope → `Cannot find package '@src/...'`. Muốn dùng phải thêm bước viết lại đường dẫn sau build (`tsc-alias`) hoặc custom loader.
- **`#` là ký tự Node dành riêng cho subpath imports** — Node, `tsc` (`nodenext`) và Vitest đều hiểu sẵn, không cần thêm công cụ.

### Hai lỗi đã gặp — vẫn phải tránh

1. **Một class import bằng 2 kiểu specifier → NestJS DI coi là 2 class khác nhau.** Vite/Vitest coi `#src/a.js` và `../a.js` là 2 module riêng (dù cùng 1 file) → 2 object class khác tham chiếu → "Nest can't resolve dependencies". Typecheck, lint và unit test có mock **không bắt được**, chỉ lộ ra khi chạy DI thật (e2e, app boot). → Đây là lý do quy tắc là "`#src` ở mọi nơi", không có vùng nào được trộn với relative.
2. **Vitest không được resolve `#src` sang `dist/`.** Nếu bỏ `resolve.alias` trong config Vitest, Vite đi theo điều kiện `default` → test chạy trên bản build cũ trong `dist/` (hoặc lỗi `Cannot find module` khi chưa build). Đừng thêm điều kiện resolve toàn cục (`ssr.resolve.conditions`) thay cho alias — nó đổi cách resolve của cả dependency (đã làm vỡ `@opentelemetry/api`).

Ngoài ra: **không chạy dev/build code NestJS bằng `tsx`/esbuild** — esbuild không emit đủ `design:paramtypes` (`emitDecoratorMetadata`) cho một số class (vd. `PrismaService extends PrismaClient`) → tham số constructor `undefined` lúc runtime. Dùng `nest start --watch` (dùng `tsc`).

## 5. `any` — hạn chế, có lint rule bắt

`oxlint.json` bật `@typescript-eslint/no-explicit-any: warn`. Toàn bộ `src/` hiện tại (kể cả test) **không có chỗ nào dùng `any`** — giữ nguyên như vậy. Khi thật sự cần kiểu động (hiếm, vd. tương tác với thư viện thiếu type), ưu tiên `unknown` + type guard hoặc generic thay vì `any`; nếu bắt buộc phải dùng `any`, để nguyên cảnh báo lint (không `// eslint-disable`) trừ khi có lý do rõ ràng ghi lại tại chỗ.

## 6. Thứ tự import (quy ước, không có lint rule ép)

Theo pattern đã thấy trong code hiện tại: package ngoài (`@nestjs/*`, thư viện npm khác) trước, import nội bộ (relative/alias) sau. Không cần blank line phân tách nhóm nếu file ngắn.

## 7. Khi nào tách file

Không có ngưỡng dòng cứng, nhưng nếu 1 service/controller vượt quá **~300 dòng** (vd. `auth.service.ts` từng ~480 dòng, đã được tách thành bốn service theo use case ở task 08), cân nhắc tách theo use-case (vd. tách riêng use-case đăng ký/đăng nhập/reset-password thành các service nhỏ hơn nếu chúng đủ độc lập) thay vì để 1 class ôm hết. Đây là gợi ý, không phải rule chặn PR — không tách chỉ vì "đủ số dòng" nếu logic thực sự gắn chặt với nhau.

## Checklist khi thêm file mới

- [ ] Tên file kebab-case, đúng hậu tố theo vai trò ([§1](#1-đặt-tên-file))
- [ ] File nằm trong sub-module theo thực thể, phẳng, chỉ `dto/` là thư mục con ([§2.2](#22-sub-module-theo-thực-thể-file-phẳng-bên-trong)); module nhỏ để phẳng cạnh `<module>.module.ts` ([§2.1](#21-gốc-module-chỉ-có-modulemodulets--trừ-module-nhỏ))
- [ ] Không import file ruột của module khác; chỉ dùng service được `exports` ([§2.3](#23-ranh-giới-giữa-module))
- [ ] Không tạo `index.ts` barrel file
- [ ] Import tới file trong `src/` dùng `#src/...` — không dùng relative, kể cả trong cùng thư mục và trong test
- [ ] Không thêm `any` mới trừ khi thực sự cần thiết (lint sẽ warn)
