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

Cây `src/` tổng thể nằm ở [02-modules.md §4](../architecture/02-modules.md#4-cấu-trúc-thư-mục). Phần này là **quy tắc** để biết 1 file mới phải đặt ở đâu.

### 2.1 Không để file rời ở gốc module

Gốc của module (`modules/<module>/`) chỉ chứa **đúng 1 file**: `<module>.module.ts`. Mọi file khác nằm trong 1 thư mục vai trò bên dưới. Lý do: nhìn vào gốc module là thấy ngay module có những lớp gì (controller, service, dto…), không phải lục giữa hàng chục file trộn lẫn.

Ngoại lệ: module hạ tầng nhỏ chỉ có 1–2 file (`prisma/`, `bootstrap/`, `config/`, `health/`) được để phẳng.

### 2.2 Danh sách thư mục vai trò

Chỉ dùng các tên dưới đây. **Chỉ tạo thư mục khi có ít nhất 1 file** — không tạo sẵn thư mục rỗng "cho đủ bộ".

| Thư mục        | Chứa gì                                                                                                                                                                                                              | Ví dụ                                                  |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `controllers/` | Controller, **luôn** chia 2 thư mục con theo vai trò: `storefront/` (route Người mua `/api/v1/...`) và `back-office/` (route `/api/v1/admin/...`, tiền tố `admin-`) — nhìn thư mục là biết route nào cần guard Staff | `controllers/back-office/admin-products.controller.ts` |
| `services/`    | Service (Nest provider chứa logic nghiệp vụ) + `*.spec.ts` của nó                                                                                                                                                    | `services/products/products.service.ts`                |
| `dto/`         | DTO request/response (class-validator + Swagger)                                                                                                                                                                     | `dto/products/create-product.dto.ts`                   |
| `domain/`      | Logic nghiệp vụ thuần, **không** phụ thuộc Nest/Prisma client — dễ unit test                                                                                                                                         | `category-tree.ts`                                     |
| `mappers/`     | Hàm chuyển entity Prisma → DTO response                                                                                                                                                                              | `variant-response.mapper.ts`                           |
| `constants/`   | Hằng số, regex, Prisma `include`/`select` dùng chung                                                                                                                                                                 | `product.constants.ts`                                 |
| `enums/`       | Enum riêng của module (**không** phải enum Prisma sinh ra — enum DB import từ `#src/generated/prisma`)                                                                                                               | `product-sort.enum.ts`                                 |
| `decorators/`  | Decorator tự viết (param decorator, validator decorator)                                                                                                                                                             | `option-code.decorator.ts`                             |
| `guards/`      | Guard                                                                                                                                                                                                                | `ownership.guard.ts`                                   |
| `strategies/`  | Passport strategy                                                                                                                                                                                                    | `jwt.strategy.ts`                                      |
| `events/`      | Tên + payload event module phát ra                                                                                                                                                                                   | `order-placed.event.ts`                                |
| `types/`       | Type/interface dùng chung trong module, không phải DTO                                                                                                                                                               | `variant-with-options.type.ts`                         |

Thứ tự ưu tiên khi phân vân: có decorator Nest (`@Injectable`) → `services/`; có decorator class-validator/Swagger → `dto/`; hàm thuần không I/O → `domain/` (nếu là luật nghiệp vụ) hoặc `mappers/` (nếu chỉ đổi hình dạng dữ liệu).

### 2.3 Thư mục con theo thực thể

Trong 1 thư mục vai trò, chia tiếp theo **thực thể** khi thỏa **cả hai**:

- có từ **2 thực thể trở lên** (vd. categories, products), **và**
- có **hơn ~6 file**.

Không thỏa thì để phẳng. Quy tắc này áp dụng cho **mọi** thư mục vai trò (`services/`, `dto/`, `constants/`, `mappers/`…), không riêng `services/`.

Tên thư mục thực thể: kebab-case, **số nhiều**, trùng tên resource trên URL — `categories/`, `products/`, `product-options/`. Không dùng `productService/`, `product/`, `ProductService/`.

Tên file bên trong vẫn đầy đủ (không rút gọn vì đã có thư mục cha) để tìm file bằng tên (Ctrl+P) không bị trùng:

```text
services/products/
├── products.service.ts               # storefront: ProductsService
├── admin-products.service.ts         # back-office: AdminProductsService
├── admin-product-images.service.ts   # back-office: ảnh sản phẩm
└── *.spec.ts                         # spec nằm cạnh file được test
```

Phân biệt service storefront/back-office bằng **tiền tố `admin-`** trong tên file, không bằng thư mục.

### 2.4 Test

`*.spec.ts` nằm **cạnh** file được test (mặc định của Nest), không tạo `__tests__/`. E2E test nằm ở `test/` gốc repo.

### 2.5 `common/`

`common/` là code dùng chung toàn app, cũng chia theo vai trò, không để file rời:

```text
common/
├── filters/      # all-exceptions.filter.ts
├── middleware/   # request-id.middleware.ts
├── logging/      # app-logger.ts, request-context.ts
├── utils/        # slug.util.ts, prisma-error.util.ts
├── pagination/   # paginate.ts, pagination.dto.ts, pagination-meta.dto.ts
└── swagger/      # api-error-responses.decorator.ts, api-tags.ts, error-response.dto.ts
```

### 2.6 Ví dụ hoàn chỉnh: `modules/catalog/`

```text
catalog/
├── catalog.module.ts
├── controllers/
│   ├── storefront/                  # 3 file → phẳng
│   │   ├── categories.controller.ts
│   │   ├── products.controller.ts
│   │   └── product-options.controller.ts
│   └── back-office/                 # 3 file → phẳng
│       ├── admin-categories.controller.ts
│       ├── admin-products.controller.ts
│       └── admin-product-options.controller.ts
├── services/                        # 3 thực thể, 13 file → chia
│   ├── categories/
│   ├── products/
│   └── product-options/
├── dto/                             # 3 thực thể, 30 file → chia
│   ├── categories/
│   ├── products/                    # product, variant, image
│   └── product-options/             # size, color, option-summary
├── domain/          category-tree.ts (+spec)
├── mappers/         variant-response.mapper.ts
├── constants/       product.constants.ts, variant-include.constant.ts
└── decorators/      option-code.decorator.ts
```

## 3. Barrel file (`index.ts`) — **cấm**

Không tạo file `index.ts` để re-export gộp nhiều module con. Mọi import phải trỏ thẳng tới file thật (vd. `from './dto/create-resource.dto.js'`, không phải `from './dto/index.js'`).

**Lý do**: project dùng ESM (`"type": "module"`) + NestJS DI dựa trên **class reference làm token**. Barrel file (đặc biệt với vòng phụ thuộc giữa các module) là nguồn gây lỗi kinh điển trong ESM — module load theo thứ tự khác dự kiến, hoặc 1 class bị load 2 lần qua 2 đường (trực tiếp và qua barrel) tạo ra 2 object class khác nhau về mặt tham chiếu, khiến NestJS DI báo "cannot resolve dependency" dù code nhìn thì đúng 100% (xem thêm [§4](#4-import-alias-src--dùng-ở-mọi-nơi) — đây là **chính xác loại bug** đã gặp phải khi thử nghiệm alias, chỉ khác là do 2 specifier khác nhau resolve ra thay vì qua barrel).

## 4. Import alias `#src/*` — dùng ở mọi nơi

Mọi import trỏ vào `src/` dùng alias `#src/*`, kể cả trong cùng thư mục và trong file test. Không dùng relative import (`./`, `../`) tới file trong `src/`. Ngoại lệ: `src/generated/` (Prisma sinh tự động) và import tới `test/support/` từ file e2e.

```ts
// ✓ Đúng — ở bất kỳ đâu (src/, *.spec.ts, test/)
import { PrismaService } from '#src/prisma/prisma.service.js';

// ✗ Sai
import { PrismaService } from '../../prisma/prisma.service.js';
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

Không có ngưỡng dòng cứng, nhưng nếu 1 service/controller vượt quá **~300 dòng** (vd. `auth.service.ts` hiện ~480 dòng, đã là file lớn nhất project), cân nhắc tách theo use-case (vd. tách riêng use-case đăng ký/đăng nhập/reset-password thành các service nhỏ hơn nếu chúng đủ độc lập) thay vì để 1 class ôm hết. Đây là gợi ý, không phải rule chặn PR — không tách chỉ vì "đủ số dòng" nếu logic thực sự gắn chặt với nhau.

## Checklist khi thêm file mới

- [ ] Tên file kebab-case, đúng hậu tố theo vai trò ([§1](#1-đặt-tên-file))
- [ ] File nằm trong đúng thư mục vai trò ([§2.2](#22-danh-sách-thư-mục-vai-trò)), không để rời ở gốc module
- [ ] Nếu thư mục vai trò vượt ngưỡng ([§2.3](#23-thư-mục-con-theo-thực-thể)) → chia theo thực thể
- [ ] Không tạo `index.ts` barrel file
- [ ] Import tới file trong `src/` dùng `#src/...` — không dùng relative, kể cả trong cùng thư mục và trong test
- [ ] Không thêm `any` mới trừ khi thực sự cần thiết (lint sẽ warn)
