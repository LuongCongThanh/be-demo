import { BadRequestException } from '@nestjs/common';
import slugify from 'slugify';

/**
 * Slug từ tên (tiếng Việt). Tên chỉ gồm ký tự đặc biệt (vd. "!!!") qua được
 * @IsNotEmpty() nhưng sinh slug rỗng — chặn lại thay vì để mọi tên "vô nghĩa"
 * sau đó bị báo trùng nhau.
 */
export function toSlugOrThrow(name: string, label: string): string {
  const slug = slugify(name, { lower: true, locale: 'vi', strict: true });
  if (!slug) {
    throw new BadRequestException(`${label} name "${name}" does not produce a valid slug`);
  }
  return slug;
}
