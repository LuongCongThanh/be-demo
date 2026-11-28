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

Class bên trong file dùng PascalCase khớp tên file (`token.service.ts` → `TokenService`). Biến/instance dùng camelCase (`private readonly productService: ProductService`).

**Vì sao kebab-case cho tên file và thư mục (không dùng `productService/`, `ProductService.ts`)?** Đây là quy ước được ghi lại ở đây, chưa có lint rule ép:

- Theo NestJS: `nest g service product-options` sinh ra `product-options/product-options.service.ts`; style guide chính thức của Nest cũng dùng kebab-case. camelCase chỉ dành cho **tên biến**, PascalCase cho **tên class**.
- Tránh bug phân biệt hoa/thường: Linux (CI, Docker) phân biệt hoa/thường trong đường dẫn còn macOS/Windows thì không — import `productService` vs `ProductService` chạy được ở máy dev nhưng vỡ trên CI. Toàn chữ thường thì không xảy ra.

## 2. Cấu trúc thư mục theo module

Kiến trúc, bộ khung thư mục và ranh giới module là một chuẩn duy nhất cho mọi module: [module-architecture-conventions.md](module-architecture-conventions.md). Cây source hiện tại và danh sách module nằm ở [02-modules.md §4](../architecture/02-modules.md#4-cấu-trúc-thư-mục). Phần này chỉ giữ quy tắc đặt tên và nhóm file để biết 1 file mới phải đặt ở đâu.

### 2.1 Gốc module và feature folder theo thực thể

Gốc `modules/<module>/` chứa `<module>.module.ts` làm composition root và bộ khung `domain/`, `application/`, `infrastructure/`, `presentation/`, `admin/`, `storefront/`. Module có nhiều thực thể (`catalog`) tách theo thư mục thực thể và lặp cùng bộ khung trong mỗi feature; feature folder không mặc nhiên là một Nest module riêng (chỉ Category tách Core/Admin/Storefront theo quy tắc có điều kiện ở module-architecture §2). Chỉ tạo thư mục khi có file thật, không dựng trước cây rỗng.

### 2.2 Feature folder theo thực thể, file nhóm theo vai trò

Mỗi thực thể là một thư mục kebab-case **số ít**, trùng tên resource trên URL ở dạng số ít: `product/`, `category/`, `product-option/`, `pricing/`. Bên trong, file nhóm theo tầng và bề mặt theo bảng ở [module-architecture-conventions.md §2](module-architecture-conventions.md#2-bộ-khung-thư-mục); không tạo thư mục `controllers/storefront|admin`, `services/storefront|admin` hay `mappers/shared` như bố cục cũ. Trong thư mục bề mặt (`admin/`, `storefront/`) nhóm tiếp theo vai trò:

- `controllers/`, `dto/`, `mappers/` và guard riêng của bề mặt; service nằm ở `application/`, không nằm trong thư mục bề mặt.
- `domain/` cho luật nghiệp vụ, hằng số, enum, Domain Model và helper thuần; `decorators/`, `guards/`, `strategies/`, `utils/` chỉ khi module có loại file đó (strategy, interceptor dùng chung ở `presentation/`).
- Thành phần dùng cho cả hai bề mặt đặt ở `presentation/`; không nhân đôi file chỉ để cây cân đối. Module chỉ phục vụ một bề mặt vẫn giữ thư mục bề mặt đó.

Swagger dùng tag riêng có tiền tố `Storefront —` hoặc `Admin CMS —` để tìm endpoint theo người dùng.

Test `*.spec.ts` đặt cạnh file được test. Cây hiện tại của `catalog/`, `identity/` và `voucher/` nằm tại [02-modules.md §4](../architecture/02-modules.md#4-cấu-trúc-thư-mục).

`admin/` là bề mặt **Back-office**, không phải Vai trò Admin; giữ tiền tố `admin-` trong tên file của bề mặt này để tìm nhanh và giữ tên class/`operationId` ổn định. Không suy ra route chỉ từ folder hoặc tên file: route do decorator của Controller quyết định, còn quyền được khai báo rõ bằng `@Authorize(Permission...)`.

Tên file bên trong vẫn đầy đủ (không rút gọn vì đã có thư mục cha) để tìm file bằng tên (Ctrl+P) không bị trùng: `product.service.ts`, không phải `service.ts`.

Thứ tự ưu tiên khi phân vân hậu tố: có decorator Nest (`@Injectable`) → `.service.ts`; có decorator class-validator/Swagger → `dto/*.dto.ts`; hàm thuần không I/O → không hậu tố nếu là luật nghiệp vụ (`category-tree.ts`, `order-state-machine.ts`), `.mapper.ts` nếu chỉ đổi hình dạng dữ liệu; Persistence Port → `<tên>.repository.ts`, adapter → `prisma-<tên>.repository.ts`; port I/O khác → `<tên>.port.ts`.

### 2.3 Ranh giới giữa module

- Cửa ngõ của module là `<module>.module.ts` và **một** class công khai `application/<module>.service.ts`; module khác chỉ import hai file đó, không import file ruột theo đường dẫn. Chi tiết và luật lint: [module-architecture-conventions.md §7](module-architecture-conventions.md#7-ranh-giới-module-và-feature).
- Port/DI: `abstract class` làm token, một Persistence Port mỗi feature; không dùng `Symbol` + `@Inject`. Xem module-architecture §4.
- Transaction xuyên module chạy qua `TransactionRunner` và service công khai của từng module ([module-architecture-conventions.md §6](module-architecture-conventions.md#6-transaction)); không để controller quản lý transaction.
- `common/` không import `http/`, `security/`, `infrastructure/` hoặc `modules/`; quy tắc chi tiết về các thư mục dùng chung cấp ứng dụng ở §2.5.
- Giữ `CatalogModule` làm composition root bên ngoài cho Catalog (import `CategoryModule`, module duy nhất đang tách Core/Admin/Storefront) và `IdentityModule` làm composition root hiện tại. Các feature folder còn lại không cần Nest module riêng chỉ để cây thư mục đồng đều. Chỉ cân nhắc tách thêm khi có nhu cầu độc lập về ownership, lifecycle, kiểm thử hoặc export service; trước khi tách phải xác nhận dependency một chiều, không có vòng import và chỉ export API cần thiết.

### 2.4 Test

`*.spec.ts` nằm **cạnh** file được test (mặc định của Nest), không tạo `__tests__/`. E2E nằm trong `test/`, xếp theo audience rồi theo domain:

```text
test/
├── admin/
├── storefront/
├── shared/       # luồng E2E đi qua nhiều audience
├── system/       # health, metrics, mail, CLI, migration, versioning
└── support/      # helper dùng chung, không chứa test suite
```

Suite theo riêng một bề mặt API đặt dưới `admin/` hoặc `storefront/`; test bao phủ luồng qua cả hai đặt dưới `shared/`. Unit spec vẫn đi cùng source, không chuyển vào `test/`.

### 2.5 Các thư mục dùng chung cấp ứng dụng

Mỗi thư mục cấp ứng dụng có trách nhiệm riêng; không dùng `common/` làm nơi chứa mọi thứ "được dùng ở nhiều nơi":

```text
common/
├── pagination/   # paginate.ts, pagination.dto.ts, pagination-meta.dto.ts
├── swagger/      # api-error-responses.decorator.ts, api-tags.ts, error-response.dto.ts
├── utils/        # slug.util.ts
└── validation/   # is-strong-password.decorator.ts

http/
├── filters/      # global HTTP exception mapping
└── middleware/  # HTTP request pipeline, ví dụ request-id

security/
├── contracts/      # jwt-payload.ts, permission.enum.ts
├── authentication/ # JWT guard, current-user decorator
└── authorization/  # permission/account-type/ownership policy and guards

infrastructure/
├── audit/
├── database/
├── mail/
├── observability/   # health/, logging/, metrics/
└── storage/
```

`common/` là tầng dùng chung ít phụ thuộc: không import `http/`, `security/`, `infrastructure/` hoặc `modules/`. `http/` xử lý giao thức HTTP; `security/` chứa chính sách xác thực/phân quyền dùng xuyên module. Hai tầng này có thể dùng `common/` và adapter cần thiết từ `infrastructure/`, nhưng không import business module. `security/contracts/` chứa kiểu claim và enum Quyền dùng chung để authentication và authorization không phụ thuộc vòng vào nhau. `infrastructure/` có thể dùng thành phần thuần từ `common/`, không import `modules/`. `RequestContext` và `AppLogger` thuộc `infrastructure/observability/logging/`; middleware HTTP sử dụng `RequestContext` nhưng không sở hữu nó.

`bootstrap/` chỉ lắp ráp cấu hình ứng dụng (ValidationPipe, versioning, Swagger), `config/` xác thực biến môi trường lúc khởi động, còn `cli.ts` là entry point riêng cho ứng dụng trong `cli/`. Không chuyển implementation HTTP/security vào `bootstrap/` hoặc tạo thư mục con rỗng chỉ để cây cân đối.

### 2.6 Ví dụ hoàn chỉnh

Ví dụ cấu trúc đầy đủ theo bộ khung: [`src/modules/catalog/category/`](../../src/modules/catalog/category/). Cây as-built của `identity/`, `voucher/` và các module khác ở [02-modules.md §4](../architecture/02-modules.md#4-cấu-trúc-thư-mục); module nào chưa chuyển đổi thì cây đó có thể chưa theo bộ khung (xem mục _Migration status_ của [rule agent](../../.claude/rules/module-architecture.md)).

## 3. Barrel file (`index.ts`) — **cấm**

Không tạo file `index.ts` để re-export gộp nhiều module con. Mọi import phải trỏ thẳng tới file thật (vd. `from '#src/modules/resource/dto/create-resource.dto.js'`, không phải `from '#src/modules/resource/dto/index.js'`).

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

## 6. Thứ tự import

Package ngoài (`@nestjs/*`, thư viện npm khác) đứng trước import nội bộ dùng alias `#src/*`, theo quy tắc ở §4. Không dùng relative import vào `src/`.

## 7. Khi nào tách file

Mục tiêu khoảng **150 dòng**, giới hạn cứng **200 dòng** mỗi file (không đếm dòng trống và comment; `max-lines` chặn). Vượt 200 thì tách theo trách nhiệm (ví dụ tách theo use case: đăng ký, đăng nhập, reset-password thành các service nhỏ), không tách chỉ để đạt con số khi logic gắn chặt. Miễn: code sinh tự động (`src/generated/`) và file test; ngoại lệ cho một file cụ thể chỉ khi có comment giải thích lý do ngay trong file. Chi tiết: [module-architecture-conventions.md §8](module-architecture-conventions.md#8-giới-hạn-kích-thước-file).

## Checklist khi thêm file mới

- [ ] Tên file kebab-case, đúng hậu tố theo vai trò ([§1](#1-đặt-tên-file))
- [ ] File nằm trong module/thực thể và đúng thư mục vai trò; chỉ tạo thư mục có file thực tế ([§2.2](#22-feature-folder-theo-thực-thể-file-nhóm-theo-vai-trò))
- [ ] Không import file ruột của module khác; chỉ import `<module>.module.ts` và `application/<module>.service.ts` ([§2.3](#23-ranh-giới-giữa-module))
- [ ] Không tạo `index.ts` barrel file
- [ ] Import tới file trong `src/` dùng `#src/...` — không dùng relative, kể cả trong cùng thư mục và trong test
- [ ] Không thêm `any` mới trừ khi thực sự cần thiết (lint sẽ warn)
