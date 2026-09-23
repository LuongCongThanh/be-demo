---
status: Draft
owner: Backend
last_verified: 2026-09-23
dependencies: [01-auth.md, ../adr/0005-canonical-four-role-authorization-model.md]
supersedes: null
---

# 04 — Users administration specification

## Goal

Cung cấp self-profile cho User và administration surface cho MASTER_ADMIN mà không làm Auth trở thành nơi sở hữu profile, Account Status hay role assignment.

## Scope

- User đọc/cập nhật profile của chính mình.
- MASTER_ADMIN list/search/detail Users.
- MASTER_ADMIN thay đổi Account Status.
- MASTER_ADMIN gán/gỡ các Role canonical.
- Audit mọi thay đổi đặc quyền.
- Tăng authorization version khi role/status thay đổi.

Không bao gồm MFA, social login, SSO, fine-grained permission engine hoặc xóa vật lý User.

## Proposed HTTP surface

| Method | Path                       | Actor         | Ý nghĩa                    |
| ------ | -------------------------- | ------------- | -------------------------- |
| GET    | `/api/v1/users/me`         | authenticated | Profile hiện tại           |
| PATCH  | `/api/v1/users/me`         | authenticated | Cập nhật profile cho phép  |
| GET    | `/api/v1/users`            | MASTER_ADMIN  | List/filter Users          |
| GET    | `/api/v1/users/:id`        | MASTER_ADMIN  | User detail                |
| PATCH  | `/api/v1/users/:id/status` | MASTER_ADMIN  | ACTIVE/BLOCKED             |
| PUT    | `/api/v1/users/:id/roles`  | MASTER_ADMIN  | Replace canonical role set |

OpenAPI runtime quyết định DTO chính xác sau review; endpoint role dùng replace semantics để retry an toàn.

## Invariants

- User có ít nhất một Role; CUSTOMER là default khi register.
- Chỉ MASTER_ADMIN quản lý role/status.
- Không được block, demote hoặc loại bỏ MASTER_ADMIN active+verified cuối cùng.
- Role/status mutation, authorization-version increment và audit record cùng một transaction.
- Thay đổi role/status có hiệu lực với request mới; access token mang version cũ bị từ chối.
- Không expose password/token hashes hoặc internal security fields.

## Concurrency

Check “MASTER_ADMIN cuối cùng” phải được bảo vệ bằng transaction/locking, không chỉ count rồi update rời rạc. Hai request đồng thời không được cùng loại bỏ hai admin cuối theo race.

## Audit minimum

Actor, target User, action, before/after canonical values, request id và timestamp. Không ghi secret/token/password hash.

## Acceptance scenarios

- CUSTOMER không thể list/change User khác.
- MASTER_ADMIN thay role/status thành công và token cũ của target bị từ chối.
- Không thể loại bỏ active verified MASTER_ADMIN cuối cùng, kể cả concurrent requests.
- Replace cùng role set là idempotent về business result.
- Pagination/filter không rò dữ liệu nhạy cảm.

## Implementation order

1. Chốt DTO/OpenAPI/error matrix và permission table.
2. Thiết kế audit record; tạo migration tương thích ngược nếu cần.
3. Implement list/detail và self-profile với field allowlist.
4. Implement transactional Account Status mutation, authorization-version increment và audit.
5. Implement transactional role replacement và last-MASTER_ADMIN concurrency guard.
6. Wire controller/module/Swagger; thêm unit/E2E và concurrency tests.
7. Export/review OpenAPI và cập nhật trạng thái trong `docs/README.md` bằng evidence.
