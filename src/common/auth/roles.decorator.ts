import { SetMetadata } from '@nestjs/common';
import type { AccountType } from '#src/generated/prisma/enums.js';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: AccountType[]) => SetMetadata(ROLES_KEY, roles);
