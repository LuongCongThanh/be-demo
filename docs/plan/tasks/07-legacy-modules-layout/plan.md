# Plan 07: Gộp `auth` + `staff` thành module identity

Branch: `chore/identity-module`, tạo từ `dev` sau khi PR 06 merge. Nếu 06 chưa merge thì tạo từ `chore/catalog-module` rồi rebase sau. Một PR, commit `refactor: merge auth and staff into IdentityModule`.

Hướng dẫn: [guide.md](./guide.md). Kết quả: [report.md](./report.md).

## Bảng di chuyển file

Mọi `x.spec.ts` đi cùng `x.ts`.

| Hiện tại                                                               | Đích (`src/modules/identity/…`)                     |
| ---------------------------------------------------------------------- | --------------------------------------------------- |
| `auth/auth.module.ts`, `staff/staff.module.ts`                         | **xoá**, thay bằng `identity.module.ts` (mới)       |
| `auth/auth.controller.ts`, `auth/me.controller.ts`                     | `controllers/storefront/`                           |
| `staff/staff.controller.ts`                                            | `controllers/back-office/admin-staff.controller.ts` |
| `auth/services/{auth,password,token}.service.ts`                       | `services/auth/`                                    |
| `auth/services/internal-account.service.ts`                            | `services/internal-account/`                        |
| `staff/staff.service.ts`                                               | `services/internal-account/staff.service.ts`        |
| `auth/dto/*`                                                           | `dto/auth/`                                         |
| `staff/dto/*`                                                          | `dto/staff/`                                        |
| `auth/strategies/jwt.strategy.ts`                                      | `strategies/`                                       |
| `auth/guards/email-throttler.guard.ts`                                 | `guards/`                                           |
| `auth/guards/{jwt-auth,roles,ownership}.guard.ts`, `auth/decorators/*` | **giữ nguyên** (#3)                                 |

`identity.module.ts` gộp `imports`/`providers` của 2 module cũ, giữ thứ tự controller `AuthController, MeController, AdminStaffController`, và `exports: [PassportModule, InternalAccountService]`.

## Các bước

1. [ ] Trên `dev`, ghi metric "trước" vào [metric.md](./metric.md): số `*.spec.ts`, số unit test, số e2e test, Swagger `docs-json` (lưu vào scratchpad).
2. [ ] `git mv` theo bảng. Đổi tên class `StaffController` thành `AdminStaffController`.
3. [ ] Sửa import `#src/auth/...` và `#src/staff/...` trong `src/`, `test/`, kể cả `vi.mock(...)`.
4. [ ] Tạo `identity.module.ts`. Trong `app.module.ts`, `catalog.module.ts`, `cli.module.ts`: đổi `AuthModule`/`StaffModule` thành `IdentityModule`.
5. [ ] Chạy grep AC3; chạy `lint`, `typecheck`, `test`, `test:e2e`; so với metric "trước".
6. [ ] Lấy Swagger "sau" và chạy `jq -S` diff.
7. [ ] Cập nhật mục "Hiện tại" trong `02-modules §4`.
8. [ ] Ghi metric "sau" (kể cả token: `npm run tokens -- <sessionId> --md`), chạy `/code-review`, rồi `/ship`.
9. [ ] Sau khi merge: viết `report.md`, đặt `status: done`, ghi `pr: #NN`; mở khoá task 08.

## Rủi ro

- **Thứ tự route** đổi khi gộp module: e2e và Swagger diff sẽ bắt.
- **`vi.mock` sai đường dẫn** chỉ lỗi khi chạy test: bước 3 + AC3.
- **DI**: catalog cần `PassportModule` từ `IdentityModule` để `JwtAuthGuard` chạy. Thiếu export thì e2e 401/500.
- **Đổi tên class controller** ảnh hưởng tới `operationId` của Swagger nếu nó được sinh từ tên class. Kiểm tra bằng diff; nếu diff khác rỗng vì lý do này thì giữ tên class cũ và ghi vào report.
