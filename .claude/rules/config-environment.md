---
paths:
  - 'src/**/*.ts'
---

# Config & environment (condensed — full rationale: docs/convention/config-environment-conventions.md)

- **Không bao giờ đọc thẳng `process.env.X`** trong `src/`. Luôn qua `ConfigService.get()`/`getOrThrow()` — kể cả khi class `extends` 1 class khác cần giá trị trước `super()` (lấy qua tham số constructor, không phải `this.config`, vì `this.config` chỉ gán được sau `super()`).
- Tên biến: `UPPER_SNAKE_CASE`, prefix theo nhóm (`JWT_*`, `SMTP_*`...). Thời lượng dùng string `ms`-compatible (`15m`, `7d`), không phải số giây/ms trần.
- Biến mới **phải** khai vào `src/config/env.validation.ts` (`class-validator`) — bắt buộc (không `@IsOptional()`) nếu thiếu thì app không chạy đúng được; optional (`@IsOptional()` + default tại nơi `config.get()`) nếu có thể chạy thiếu.
- Biến chỉ dùng bởi script ngoài NestJS lifecycle (vd. `POSTMAN_API_KEY`) không thuộc `EnvironmentVariables`, tự đọc `.env` riêng qua `dotenv`.
- Mọi biến mới **phải** thêm dòng tương ứng vào `.env.example` (để trống giá trị, kèm comment nếu cần) **trong cùng PR**.
- Không commit `.env` hay secret thật (kể cả trong comment/commit message/code mẫu). Leak secret = security incident, phải rotate ngay.
