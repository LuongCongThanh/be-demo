---
status: done
---

# Guide 17: Kiểm chứng closure tạo Admin

## Điểm sửa

- [InternalAccountService](../../../../../src/modules/identity/internal-account.service.ts): guard `input.role === 'ADMIN'`.
- [CreateAdminCommand](../../../../../src/cli/create-admin.command.ts): chuyển `ConflictException` thành exit code 1.
- [Unit test](../../../../../src/modules/identity/internal-account/services/admin/internal-account.service.spec.ts): kiểm tra Admin thứ hai.
- [CLI E2E](../../../../../test/system/cli-create-admin.e2e-spec.ts): kiểm tra tạo/từ chối/race.

## Luồng bất biến

1. Khoá dòng Vai trò hệ thống `Admin` bằng `FOR UPDATE`.
2. Tìm `userRole` đang gắn Vai trò `Admin` với tài khoản `ACTIVE`.
3. Nếu tồn tại, ném `409 An active Admin account already exists`.
4. Chỉ tạo user/audit trong cùng transaction khi guard pass.

## Kiểm tra

```bash
npm run test -- src/modules/identity/internal-account/services/admin/internal-account.service.spec.ts src/cli/create-admin.command.spec.ts
npm run test:e2e -- test/system/cli-create-admin.e2e-spec.ts
npm run test:e2e -- test/admin/identity/roles.e2e-spec.ts test/admin/identity/admin-staff.e2e-spec.ts
```

## Lưu ý

- Không tạo Admin qua HTTP; mọi caller của `InternalAccountService.create` đều đi qua guard.
- Chạy migration trước bộ E2E nếu DB test thiếu cột mới.
