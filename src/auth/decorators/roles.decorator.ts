import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

// Role quản lý catalog (CONTEXT.md: STORE_MANAGER manages the catalog,
// MASTER_ADMIN manages all store operations) — dùng chung cho @Roles() của
// route ghi catalog và StaffQueryFlagGuard, để hai nơi không lệch nhau.
export const CATALOG_STAFF_ROLES = ['STORE_MANAGER', 'MASTER_ADMIN'] as const;
