# Report 12: `identity/` theo layout phẳng

Trạng thái: **done**, PR #77.

## Đã làm

- `identity/` → `auth/` và `internal-account/`: controller, service, dto, spec nằm cạnh nhau; `controllers/ services/ dto/ guards/ strategies/` cũ đã xoá.
- `auth/`: `auth.controller`, `me.controller`, bốn service use case của task 08 (+ `send-best-effort`), `token.service`, `password.service`, `jwt.strategy`, `email-throttler.guard`, `dto/`.
- `internal-account/`: `admin-staff.controller`, `internal-account.service`, `dto/`.
- `staff.service.ts` gộp vào `internal-account.service.ts`; `staff.service.spec.ts` gộp vào `internal-account.service.spec.ts` (một `describe` riêng, assertion giữ nguyên). `StaffService` bỏ khỏi `providers`; `exports` không đổi.

## Kết quả

`typecheck`, `lint`, `build` xanh; unit 240/240; Swagger `jq -S` diff trước/sau rỗng; grep đường dẫn cũ trong `src` và `test`: 0 kết quả. E2E không chạy (không có DB local).

## Quyết định lệch ticket

- Hàm của Staff trong service gộp đổi tên có hậu tố `Staff` (`createStaff`, `findAllStaff`, `renameStaff`, `disableStaff`, `enableStaff`) vì `create` của Staff trùng `create(input)` đã có của Tài khoản nội bộ. Spec chỉ đổi tên hàm được gọi; `createStaff` vẫn gọi `create` (spec dùng `vi.spyOn`).
- Bất biến "luôn còn ≥ 1 Admin active" giữ nguyên: mọi hàm `*Staff` lọc `role: STAFF`, không có đường nào vô hiệu hoá Admin.
- Giữ nguyên tên class controller (operationId Swagger, CMS generated types). Branch `chore/identity-subfolders` vì hook pre-push chưa cho `refactor/`.
