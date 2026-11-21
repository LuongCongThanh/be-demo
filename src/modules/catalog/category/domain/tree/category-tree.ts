import type { Category } from '#src/modules/catalog/category/domain/models/category.model.js';

export interface CategoryTreeNode<T> {
  category: T;
  children: CategoryTreeNode<T>[];
}

/**
 * Dựng cây từ danh sách phẳng (một query, không N+1 — danh mục ít). Chỉ giữ
 * danh mục hiển thị; danh mục ẩn kéo theo cả nhánh con (con chỉ được gắn khi
 * cha đã nằm trong cây). Anh em sắp theo sortOrder rồi tên.
 */
export function buildVisibleTree<
  T extends Pick<Category, 'id' | 'parentId' | 'name' | 'slug' | 'sortOrder' | 'isVisible'>,
>(categories: T[]): CategoryTreeNode<T>[] {
  const childrenOf = new Map<string | null, T[]>();
  for (const category of categories) {
    const siblings = childrenOf.get(category.parentId) ?? [];
    siblings.push(category);
    childrenOf.set(category.parentId, siblings);
  }

  const build = (parentId: string | null): CategoryTreeNode<T>[] =>
    (childrenOf.get(parentId) ?? [])
      .filter((c) => c.isVisible)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'vi') || a.id.localeCompare(b.id))
      .map((category) => ({ category, children: build(category.id) }));

  return build(null);
}

/** Danh mục hiển thị trên storefront khi nó và mọi tổ tiên đều `isVisible`. */
export function isEffectivelyVisible<T extends Pick<Category, 'id' | 'parentId' | 'isVisible'>>(
  id: string,
  byId: Map<string, T>,
): boolean {
  const seen = new Set<string>();
  let current = byId.get(id);
  while (current) {
    if (!current.isVisible || seen.has(current.id)) return false;
    seen.add(current.id);
    if (current.parentId === null) return true;
    current = byId.get(current.parentId);
  }
  return false;
}
