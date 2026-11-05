---
paths:
  - 'src/**/*.ts'
  - 'test/**/*.ts'
---

# Coding style & naming (condensed — full rationale: docs/convention/coding-style-conventions.md)

- File name: kebab-case, suffix theo vai trò — `.module.ts`, `.controller.ts`, `.service.ts`, `.dto.ts`, `.guard.ts`, `.decorator.ts`, `.strategy.ts`, `.spec.ts`, `.e2e-spec.ts`. Class trong file dùng PascalCase khớp tên file.
- Module có ≥2 file cùng vai trò mới tách subfolder (`dto/`, `guards/`...); module nhỏ giữ phẳng.
- **Cấm barrel file** (`index.ts` re-export). Mọi import trỏ thẳng file thật, có đuôi `.js` (ESM). Lý do: barrel + NestJS DI (class reference làm token) từng gây lỗi "Nest can't resolve dependency" do 1 class bị load 2 lần với 2 reference khác nhau.
- **Import tới file trong `src/` LUÔN dùng alias `#src/*`** (Node subpath imports, khai ở `package.json` → `imports`) — ở mọi nơi: `src/**`, `*.spec.ts`, `test/**`, kể cả cùng thư mục. Không dùng relative import vào `src/`, không dùng `@src/*` (Node không resolve được ở runtime). Ngoại lệ: `src/generated/` và `test/support/`. Lý do: 1 class import bằng 2 kiểu specifier → NestJS DI coi là 2 class khác nhau, chỉ lộ ra ở e2e/app boot.
- Không thêm `any` mới (`no-explicit-any` lint rule đang warn, hiện tại `src/` không có chỗ nào dùng). Cần kiểu động → `unknown` + type guard hoặc generic.
- Thứ tự import: package ngoài trước, import nội bộ sau.
- Ngưỡng tách file: ~300 dòng/service-controller — cân nhắc tách theo use-case nếu logic đủ độc lập, không tách chỉ vì đủ số dòng.
