import { SetMetadata } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

export interface OwnedResourceOptions {
  /** Tên param trong route chứa id của resource, vd 'id' trong `/orders/:id`. */
  paramIdKey: string;
  /** Callback tự query resource theo id, trả về object có field `userId` (hoặc null nếu không tồn tại). */
  fetch: (id: string, prisma: PrismaService) => Promise<{ userId: string } | null>;
}

export const OWNED_RESOURCE_KEY = 'ownedResource';
export const OwnedResource = (options: OwnedResourceOptions) => SetMetadata(OWNED_RESOURCE_KEY, options);
