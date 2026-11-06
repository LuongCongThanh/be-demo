---
status: done
pr: #67
blocked-by: []
labels: [ready-for-agent]
---

# Spec 09: Tách cổng phân quyền thành `@Authorize` ở `common/auth/`

Branch: `chore/authorize-decorator` · Nguồn: [architecture review 2026-11-06, đề xuất #3](../../../architecture/reviews/architecture-review-2026-11-06.html)

## Problem Statement

Mỗi controller cần đăng nhập phải lặp cùng một bộ ba `@ApiBearerAuth()` + `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles(...)`, và import 3–4 file từ thư mục tạm `src/auth/`. Người viết controller phải nhớ đủ cả ba và đúng thứ tự: quên `RolesGuard` thì `@Roles` bị bỏ qua im lặng — route mở cho mọi Tài khoản đã đăng nhập, không test nào báo. Interface (3 decorator) gần phức tạp như implementation, nên cách mô hình bốn vai trò ([ADR 0005](../../../adr/0005-four-actor-authorization-model.md)) được áp dụng bị rải ra từng controller.

Thêm nữa, `config/env.validation.ts` (hạ tầng) import `IsStrongPassword` từ `auth/` (nghiệp vụ) — phụ thuộc đảo chiều. Và `CatalogModule` phải `imports: [IdentityModule]` chỉ để có guard.

## Solution

Một decorator duy nhất `@Authorize(...roles)` ở `common/auth/`, gộp xác thực JWT, kiểm vai trò và khai Swagger bearer. Người viết controller chỉ cần một dòng; không thể "gắn thiếu guard" nữa. Mọi thứ còn lại trong `src/auth/` chuyển về `common/` và thư mục `src/auth/` bị xoá. `JwtStrategy` (biết cách đọc token, tra Tài khoản) vẫn thuộc `identity`.

Hành vi bên ngoài không đổi: cùng route, cùng mã lỗi 401/403, cùng Swagger.

## User Stories

1. Là dev viết controller back-office, tôi muốn khai quyền bằng một decorator `@Authorize('STAFF','ADMIN')`, để không phải nhớ bộ ba decorator và thứ tự của chúng.
2. Là dev, tôi muốn `@Authorize` đặt được ở class lẫn method, để khai quyền mặc định cho cả controller và siết lại cho từng route (vd. xoá chỉ `ADMIN`).
3. Là dev, tôi muốn `@Authorize` ở method ghi đè `@Authorize` ở class, để giữ đúng ngữ nghĩa `getAllAndOverride` hiện tại của `@Roles`.
4. Là dev, tôi muốn `@Authorize()` không truyền vai trò nghĩa là "chỉ cần đăng nhập", để dùng cho route mọi Tài khoản đều gọi được.
5. Là dev, tôi muốn `@Authorize` tự gắn `ApiBearerAuth` cho Swagger, để tài liệu API không lệch khỏi thực tế bảo vệ route.
6. Là dev, tôi muốn chỉ import một file `#src/common/auth/...` thay vì 3–4 file từ `#src/auth/`, để controller gọn và không với vào ruột module khác.
7. Là reviewer, tôi muốn nhìn một dòng là biết route cho vai trò nào, để review phân quyền nhanh và ít sót.
8. Là reviewer, tôi muốn không còn khả năng "có `@Roles` nhưng thiếu `RolesGuard`", để lỗ hổng phân quyền im lặng không thể xảy ra.
9. Là Admin, tôi muốn các route chỉ dành cho Admin vẫn trả 403 khi Staff gọi, để việc refactor không nới quyền.
10. Là Staff, tôi muốn vẫn gọi được mọi route back-office đang cho `STAFF`, để công việc hằng ngày không bị chặn.
11. Là Customer, tôi muốn `GET /me` vẫn chỉ cho `CUSTOMER`, để hành vi hiện tại giữ nguyên.
12. Là client không gửi token, tôi muốn vẫn nhận 401 ở route được bảo vệ, để phân biệt "chưa đăng nhập" với "không đủ quyền" (403).
13. Là client storefront, tôi muốn route công khai (danh mục, sản phẩm) vẫn không yêu cầu token, để duyệt hàng không cần tài khoản.
14. Là dev module mới (pricing, cart, inventory), tôi muốn không phải `imports: [IdentityModule]` chỉ để bảo vệ route, để module nghiệp vụ không phụ thuộc identity vô cớ.
15. Là dev, tôi muốn `IsStrongPassword` nằm ở `common/validation/`, để `config` (hạ tầng) không còn import ngược vào nghiệp vụ.
16. Là dev, tôi muốn `CurrentUser` và cơ chế ownership (`OwnedResource` + `OwnershipGuard`) cũng chuyển về `common/auth/`, để `src/auth/` biến mất hẳn và không còn thư mục "TẠM".
17. Là dev viết route theo chủ sở hữu (đơn hàng sau này), tôi muốn ownership vẫn hoạt động như cũ (ADMIN bypass, 404 khi không có, 403 khi không phải của mình), để không phải viết lại khi làm `ordering`.
18. Là dev, tôi muốn một bộ unit test duy nhất cho `@Authorize` chứng minh nó gắn đủ metadata, để không cần e2e mỗi controller kiểm "đã gắn đủ guard chưa".
19. Là maintainer, tôi muốn `02-modules §4` không còn dòng `auth/ # TẠM`, để tài liệu khớp code.
20. Là maintainer, tôi muốn convention API (`api-rules.md`, `api-crud-walkthrough.md`) hướng dẫn dùng `@Authorize`, để dev mới không chép lại bộ ba cũ.
21. Là maintainer, tôi muốn lint chặn import trực tiếp `RolesGuard`/`Roles` trong controller, để không ai quay lại kiểu cũ.

## Implementation Decisions

- **Hình dạng**: chọn decorator ghép (`applyDecorators`) gắn ở controller, **không** chuyển sang guard toàn cục mặc định-từ-chối. Lý do: guard toàn cục buộc gắn `@Public()` cho mọi route storefront và `health`/`metrics`, đổi hành vi nhiều hơn phạm vi task; ghi lại là hướng có thể làm sau trong Further Notes.
- **Interface**: `Authorize(...roles: Role[])` ghép `ApiBearerAuth()`, `UseGuards(JwtAuthGuard, RolesGuard)`, `SetMetadata(ROLES_KEY, roles)`. Đọc vai trò vẫn bằng `getAllAndOverride` (method thắng class). Danh sách rỗng = chỉ yêu cầu đăng nhập. So khớp vai trò chính xác, không suy cây phân cấp (ADR 0005) — giữ nguyên `RolesGuard`.
- **Vị trí**: `common/auth/` chứa `Authorize`, `JwtAuthGuard`, `RolesGuard`, `CurrentUser`, `OwnedResource` + `OwnershipGuard`. `common/validation/` chứa `IsStrongPassword`. Xoá `src/auth/`.
- `Roles` và `ROLES_KEY` trở thành chi tiết nội bộ của `common/auth/` — không controller nào import trực tiếp nữa.
- `JwtStrategy` và kiểu `JwtPayload` ở lại `modules/identity`. Guard ở `common/auth/` chỉ cần kiểu payload; nếu import kiểu từ identity tạo phụ thuộc common → module, chuyển kiểu `JwtPayload` (chỉ kiểu, không logic) sang `common/auth/` và để `JwtStrategy` import nó.
- `JwtAuthGuard` là `AuthGuard('jwt')`; strategy Passport đăng ký toàn cục khi `IdentityModule` nạp, nên `CatalogModule` bỏ `imports: [IdentityModule]` (trừ khi còn dùng service khác từ identity — kiểm khi làm).
- Thay mọi chỗ dùng bộ ba ở `admin-categories`, `admin-products`, `admin-product-options`, `admin-staff`, `me` bằng `@Authorize(...)`. Các override cấp method `@Roles('ADMIN')` thành `@Authorize('ADMIN')`.
- Thêm luật ESLint `no-restricted-imports` chặn import `RolesGuard`/`roles.decorator` ngoài `common/auth/`.
- Không đổi schema, route, response, mã lỗi, Swagger.

## Testing Decisions

- **Test tốt** ở đây kiểm hành vi quan sát được từ HTTP (401/403/200) và metadata mà decorator gắn — không kiểm thứ tự gọi nội bộ.
- **Seam chính (giữ nguyên, không thêm seam mới)**: e2e qua HTTP. `test/roles.e2e-spec.ts` đã phủ ma trận bốn vai trò × route; `admin-staff`, `categories`, `products`, `admin-sizes-colors`, `auth-me` e2e phủ từng controller. Toàn bộ phải xanh **không sửa assertion**.
- **Unit test mới cho `Authorize`** (cùng kiểu `roles.guard.spec.ts`): áp lên một class/method giả, đọc lại metadata bằng `Reflector` — có guards `JwtAuthGuard`+`RolesGuard`, có roles đúng, method ghi đè class, rỗng = chỉ đăng nhập, có metadata Swagger bearer.
- Di chuyển nguyên `roles.guard.spec.ts`, `ownership.guard.spec.ts`, `is-strong-password.decorator.spec.ts` theo file nguồn; chỉ sửa import.
- Swagger: `jq -S` diff của tài liệu OpenAPI trước/sau phải rỗng (prior art: task 06).
- `lint`, `typecheck`, `test`, `test:e2e` xanh.

## Out of Scope

- Guard toàn cục mặc định-từ-chối + `@Public()`.
- Đổi ngữ nghĩa phân quyền, thêm vai trò, phân cấp vai trò.
- Di chuyển hạ tầng sang `infrastructure/` (task 10).
- Áp `@OwnedResource` cho route mới (chưa có route nào dùng).

## Further Notes

- Đây là đề xuất được review khuyến nghị làm trước: cắt lý do khiến module nghiệp vụ dính vào `auth/`, và nên chốt trước khi bắt đầu `pricing`/`cart`/`inventory`.
- Nếu sau này chọn guard toàn cục, `@Authorize` vẫn là interface cho controller — chỉ implementation đổi; vì vậy làm decorator trước không chặn hướng đó.
