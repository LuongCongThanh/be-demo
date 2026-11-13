import type { Category } from '#src/generated/prisma/client.js';
import { CategoryTreeNodeDto } from '#src/modules/catalog/category/dto/category-tree-node.dto.js';

/**
 * Dựng cây từ danh sách phẳng (một query, không N+1 — danh mục ít). Chỉ giữ
 * danh mục hiển thị; danh mục ẩn kéo theo cả nhánh con (con chỉ được gắn khi
 * cha đã nằm trong cây). Anh em sắp theo sortOrder rồi tên.
 */
export function buildVisibleTree(categories: Category[]): CategoryTreeNodeDto[] {
  const childrenOf = new Map<string | null, Category[]>();
  for (const category of categories) {
    const siblings = childrenOf.get(category.parentId) ?? [];
    siblings.push(category);
    childrenOf.set(category.parentId, siblings);
  }

  const build = (parentId: string | null): CategoryTreeNodeDto[] =>
    (childrenOf.get(parentId) ?? [])
      .filter((c) => c.isVisible)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'vi') || a.id.localeCompare(b.id))
      .map((c) => ({ id: c.id, name: c.name, slug: c.slug, children: build(c.id) }));

  return build(null);
}

/** Danh mục hiển thị trên storefront khi nó và mọi tổ tiên đều `isVisible`. */
export function isEffectivelyVisible(id: string, byId: Map<string, Category>): boolean {
  for (let current = byId.get(id); current; current = current.parentId ? byId.get(current.parentId) : undefined) {
    if (!current.isVisible) return false;
  }
  return byId.has(id);
}
