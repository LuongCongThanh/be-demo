# Guide 07: Gộp `auth` + `staff` thành module identity

## Layout đích

```text
src/modules/identity/
├── identity.module.ts            # exports: PassportModule, InternalAccountService
├── controllers/
│   ├── storefront/               # auth.controller, me.controller
│   └── back-office/              # admin-staff.controller
├── services/
│   ├── auth/                     # auth (tách ở task 08), password, token
│   └── internal-account/         # internal-account, staff
├── dto/{auth,staff}/
├── strategies/                   # jwt.strategy
└── guards/                       # email-throttler (riêng identity)

src/auth/                         # TẠM: chỉ guard/decorator dùng chung, #3 sẽ chuyển đi
├── guards/{jwt-auth,roles,ownership}.guard.ts
└── decorators/{roles,current-user,owned-resource,is-strong-password}.decorator.ts
```

## Vì sao guard ở lại `src/auth/`

Catalog và mọi controller back-office đều import các guard này. #3 sẽ thay chúng bằng `@Authorize` ở `common/auth/`. Nếu chuyển chúng vào identity bây giờ, mỗi file sẽ phải đổi import hai lần.

## Cách di chuyển an toàn

1. Chụp trạng thái "trước" (xem plan bước 1).
2. Chỉ dùng `git mv`, để `git diff -M` hiện `R`.
3. Dùng sed trên chuỗi `#src/auth/services/`, `#src/auth/dto/`, `#src/auth/strategies/`, `#src/auth/guards/email-throttler`, `#src/auth/(auth|me).controller`, `#src/staff/`. **Đừng** sed `#src/auth/guards/` hay `#src/auth/decorators/` hàng loạt.
4. Chạy grep AC3, phải rỗng.
5. Chạy `lint`, `typecheck`, `test`, `test:e2e`; số test phải bằng trước.
6. `diff <(jq -S . before.json) <(jq -S . after.json)` phải rỗng.

## Bẫy

- Không tạo barrel `index.ts` (coding-style §3).
- `test/support/create-test-app.ts` import `email-throttler.guard`; quên file này thì e2e không boot được.
- `roles.guard`, `ownership.guard`, `current-user.decorator` ở lại `src/auth/` nhưng import `JwtPayload` từ `jwt.strategy`: sửa riêng 3 dòng này.
- Export `PassportModule`; nếu thiếu, `JwtAuthGuard` trong catalog sẽ không resolve được strategy.
