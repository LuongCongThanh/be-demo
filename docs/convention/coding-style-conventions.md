# Convention: Coding Style & Naming (ecommerce project)

> 📖 Xem [README.md](README.md) để biết vị trí file này trong toàn bộ convention và thứ tự đọc.

Tài liệu này dành cho **dev trong team tự đọc và tự viết code**. Đọc xong, bạn biết: đặt tên file/class thế nào, khi nào tách file, import kiểu gì, và vì sao 1 vài quyết định ở đây (đặc biệt phần import alias) lại rắc rối hơn bình thường — vì đã thật sự thử và vấp phải bug trước khi chốt.

## 1. Đặt tên file

Kebab-case, hậu tố theo vai trò — đúng pattern đã dùng xuyên suốt `../../src`:

| Vai trò    | Hậu tố           | Ví dụ                       |
| ---------- | ---------------- | --------------------------- |
| Module     | `.module.ts`     | `auth.module.ts`            |
| Controller | `.controller.ts` | `auth.controller.ts`        |
| Service    | `.service.ts`    | `token.service.ts`          |
| DTO        | `.dto.ts`        | `create-resource.dto.ts`    |
| Guard      | `.guard.ts`      | `ownership.guard.ts`        |
| Decorator  | `.decorator.ts`  | `current-user.decorator.ts` |
| Strategy   | `.strategy.ts`   | `jwt.strategy.ts`           |
| Test       | `.spec.ts`       | `token.service.spec.ts`     |
| E2E test   | `.e2e-spec.ts`   | `auth-login.e2e-spec.ts`    |

Class bên trong file dùng PascalCase khớp tên file (`token.service.ts` → `TokenService`).

## 2. Cấu trúc thư mục theo module

Mỗi module nghiệp vụ (`auth/`, `mail/`...) tổ chức con theo vai trò khi có ≥ 2 file cùng vai trò: `dto/`, `guards/`, `decorators/`, `services/`, `strategies/`. Module nhỏ (1 service, 1 module file, không DTO) không cần tạo thư mục con rỗng — xem `../../prisma`, `bootstrap/`, `config/` làm ví dụ module hạ tầng phẳng, không cần subfolder.

## 3. Barrel file (`index.ts`) — **cấm**

Không tạo file `index.ts` để re-export gộp nhiều module con. Mọi import phải trỏ thẳng tới file thật (vd. `from './dto/create-resource.dto.js'`, không phải `from './dto/index.js'`).

**Lý do**: project dùng ESM (`"type": "module"`) + NestJS DI dựa trên **class reference làm token**. Barrel file (đặc biệt với vòng phụ thuộc giữa các module) là nguồn gây lỗi kinh điển trong ESM — module load theo thứ tự khác dự kiến, hoặc 1 class bị load 2 lần qua 2 đường (trực tiếp và qua barrel) tạo ra 2 object class khác nhau về mặt tham chiếu, khiến NestJS DI báo "cannot resolve dependency" dù code nhìn thì đúng 100% (xem thêm [§4](#4-import-alias--phạm-vi-rất-hẹp-và-vì-sao) — đây là **chính xác loại bug** đã gặp phải khi thử nghiệm alias, chỉ khác là do 2 specifier khác nhau resolve ra thay vì qua barrel).

## 4. Import alias — phạm vi rất hẹp, và vì sao

Project có 1 alias duy nhất, khai ở `../../tsconfig.json`:

```json
"paths": {
  "@src/*": ["./src/*"]
}
```

**Phạm vi dùng alias — chỉ trong file test** (`test/**/*.ts`, `src/**/*.spec.ts`):

```ts
// ✓ Đúng — trong file test
import { PrismaService } from '@src/prisma/prisma.service.js';
```

**Không dùng alias trong code chạy thật (`../../src` — trừ file `.spec.ts`)** — mọi import ở đó vẫn dùng relative (`..`, `../../doc`) như từ trước tới giờ:

```ts
// ✓ Đúng — trong src/auth/services/auth.service.ts
import { PrismaService } from '../../prisma/prisma.service.js';

// ✗ Sai — KHÔNG dùng alias ở đây
import { PrismaService } from '@src/prisma/prisma.service.js';
```

### Vì sao lại chia phạm vi kỳ lạ vậy — không phải "cho gọn" thì dùng khắp nơi luôn?

Đây là kết quả sau khi **thử thật và gặp 2 bug nghiêm trọng**, không phải quyết định lý thuyết — ghi lại rõ để không ai lặp lại thử nghiệm tốn thời gian này:

1. **`tsx`/esbuild làm vỡ decorator metadata.** NestJS DI cần TypeScript emit `design:paramtypes` metadata (`emitDecoratorMetadata`) để biết inject class nào vào constructor. `tsx` (dùng esbuild) không emit đúng metadata này cho một số trường hợp (cụ thể: class extend 1 class phức tạp khác, như `PrismaService extends PrismaClient`) — kết quả: tham số constructor nhận `undefined` lúc runtime, lỗi `Cannot read properties of undefined`. → **Không chạy dev/build bằng `tsx`/esbuild cho code NestJS có DI** — `nest start --watch` (dùng `tsc` thật) là lựa chọn an toàn duy nhất đã verify.

2. **Trộn alias + relative import cho cùng 1 class → NestJS DI không nhận ra nhau.** Khi 1 class (vd. `PrismaService`) được import bằng **2 kiểu specifier khác nhau** ở 2 nơi (nơi A dùng alias `@src/...`, nơi B dùng relative `./...`), Vite/Vitest coi đây là **2 module khác nhau** (dù cùng trỏ tới 1 file vật lý) → tạo ra **2 object class riêng biệt về tham chiếu**. NestJS DI match provider bằng class reference, nên báo lỗi "Nest can't resolve dependencies" / "could not find X element" dù code đọc vào hoàn toàn hợp lý. Lỗi này **không bị bắt bởi typecheck, lint, hay unit test có mock** — chỉ lộ ra khi chạy DI thật (e2e test, hoặc app thật lúc boot).

   → Do đó bất kỳ class nào là NestJS provider (`@Injectable()`, dùng trong `providers: []`) **phải được import theo đúng 1 kiểu resolution xuyên suốt mọi nơi nó được dùng làm DI token**. Cách an toàn nhất để đảm bảo điều này mà không phải audit tay từng class: **giữ nguyên toàn bộ `../../src` dùng relative import** (không có class nào lẫn 2 kiểu), chỉ cho phép alias ở lớp ngoài cùng — file test — nơi alias chỉ dùng để `import` phục vụ gọi `moduleFixture.get(X)`/mock, không tham gia vào graph DI nội bộ của `../../src`.

3. **Ký tự alias: `#` (Node subpath imports) khác `@` (npm scoped package).** Ban đầu thử `@/*` cho alias — Node runtime báo `Cannot find package '@/...'` vì bất kỳ specifier bắt đầu bằng `@` đều bị Node coi là tên package npm có scope, đi tìm trong `node_modules`. `#` mới là ký tự Node dành riêng cho "subpath imports" (package.json `imports` field). Vì alias trong project này **chỉ tồn tại trong phạm vi Vitest** (không bao giờ chạm tới Node runtime thật, vì `../../src` không dùng alias), nên có thể dùng `@src` mà không vi phạm giới hạn của Node — Vitest tự resolve qua `tsconfig.json` (`resolve.tsconfigPaths: true`, xem `vitest.config.ts`/`vitest.config.e2e.ts`), không đi qua Node module loader.

**Tóm lại — quy tắc thực dụng**: nếu bạn đang viết code trong `../../src` (trừ `.spec.ts`), dùng relative import, không có ngoại lệ, không có barrel file để rút ngắn. Nếu bạn đang viết file test và thấy `../../../src/...` dài dòng, dùng `@src/...`.

## 5. `any` — hạn chế, có lint rule bắt

`../../oxlint.json` bật `@typescript-eslint/no-explicit-any: warn`. Toàn bộ `src/` hiện tại (kể cả test) **không có chỗ nào dùng `any`** — giữ nguyên như vậy. Khi thật sự cần kiểu động (hiếm, vd. tương tác với thư viện thiếu type), ưu tiên `unknown` + type guard hoặc generic thay vì `any`; nếu bắt buộc phải dùng `any`, để nguyên cảnh báo lint (không `// eslint-disable`) trừ khi có lý do rõ ràng ghi lại tại chỗ.

## 6. Thứ tự import (quy ước, không có lint rule ép)

Theo pattern đã thấy trong code hiện tại: package ngoài (`@nestjs/*`, thư viện npm khác) trước, import nội bộ (relative/alias) sau. Không cần blank line phân tách nhóm nếu file ngắn.

## 7. Khi nào tách file

Không có ngưỡng dòng cứng, nhưng nếu 1 service/controller vượt quá **~300 dòng** (vd. `auth.service.ts` hiện ~480 dòng, đã là file lớn nhất project), cân nhắc tách theo use-case (vd. tách riêng use-case đăng ký/đăng nhập/reset-password thành các service nhỏ hơn nếu chúng đủ độc lập) thay vì để 1 class ôm hết. Đây là gợi ý, không phải rule chặn PR — không tách chỉ vì "đủ số dòng" nếu logic thực sự gắn chặt với nhau.

## Checklist khi thêm file mới

- [ ] Tên file kebab-case, đúng hậu tố theo vai trò ([§1](#1-đặt-tên-file))
- [ ] Không tạo `index.ts` barrel file
- [ ] Import trong `../../src` (trừ `.spec.ts`) dùng relative — không alias
- [ ] Import trong file test (`test/**/*.ts`, `src/**/*.spec.ts`) luôn dùng `@src/...` — không dùng relative, kể cả khi path ngắn (giữ nhất quán, không phải tự phán đoán "đủ dài chưa")
- [ ] Không thêm `any` mới trừ khi thực sự cần thiết (lint sẽ warn)
