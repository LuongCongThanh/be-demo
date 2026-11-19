export const CATEGORY_IMAGE_FORMATS = ['jpg', 'png', 'webp'] as const;
export const CATEGORY_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export enum CategoryImageSlot {
  THUMBNAIL = 'thumbnail',
  BANNER = 'banner',
}
export const categoryImagePrefix = (id: string, slot: CategoryImageSlot) => `categories/${id}/${slot}/`;
export function isCategoryImageKey(id: string, slot: CategoryImageSlot, key: string): boolean {
  const prefix = categoryImagePrefix(id, slot);
  return (
    key.startsWith(prefix) &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(key.slice(prefix.length))
  );
}
