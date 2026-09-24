import { randomUUID } from 'node:crypto';
import { PrismaService } from '@src/prisma/prisma.service.js';
import { FakeObjectStorageService } from './fake-object-storage.service.js';

let productCodeSeq = 0;

/** Product Code duy nhất giữa các lần chạy: `[A-Z0-9]{2,20}`. */
export function uniqueProductCode(prefix: string): string {
  productCodeSeq += 1;
  return `${prefix}${Date.now().toString(36).toUpperCase()}${productCodeSeq}`.slice(0, 20);
}

export interface OptionValueFixtures {
  black: { id: string; code: string };
  white: { id: string; code: string };
  sizeM: { id: string; code: string };
  sizeL: { id: string; code: string };
  hiddenColor: { id: string; code: string };
}

/**
 * Option Value cho spec catalog — tạo thẳng qua Prisma vì đây là dữ liệu
 * dựng sẵn, không phải hành vi đang test (Option Values có e2e riêng). Mã có
 * `codePrefix` để `deleteOptionValueFixtures` dọn được.
 */
export async function createOptionValueFixtures(
  prisma: PrismaService,
  codePrefix: string,
): Promise<OptionValueFixtures> {
  const suffix = Date.now().toString(36).slice(-3).toUpperCase();
  const make = (type: 'COLOR' | 'SIZE', tag: string, hidden = false) =>
    prisma.optionValue.create({
      data: { type, name: `${codePrefix} ${tag}`, code: `${codePrefix}${tag}${suffix}`, hidden },
      select: { id: true, code: true },
    });
  return {
    black: await make('COLOR', 'B'),
    white: await make('COLOR', 'W'),
    sizeM: await make('SIZE', 'M'),
    sizeL: await make('SIZE', 'L'),
    hiddenColor: await make('COLOR', 'H', true),
  };
}

export async function deleteOptionValueFixtures(prisma: PrismaService, codePrefix: string): Promise<void> {
  await prisma.optionValue.deleteMany({ where: { code: { startsWith: codePrefix } } });
}

/** Key Pending Upload đã "upload xong" trên fake storage, dùng thẳng trong `images[]`. */
export function uploadedImageKey(objectStorage: FakeObjectStorageService): string {
  const key = `tmp/product-image/${randomUUID()}.jpg`;
  objectStorage.objects.add(key);
  return key;
}
