import { describe, expect, it } from 'vitest';
import type { Category } from '#src/generated/prisma/client.js';
import { buildVisibleTree, isEffectivelyVisible } from '#src/categories/category-tree.js';

const cat = (id: string, parentId: string | null, over: Partial<Category> = {}): Category => ({
  id,
  parentId,
  name: id,
  slug: id,
  description: null,
  sortOrder: 0,
  isVisible: true,
  createdAt: new Date(0),
  updatedAt: new Date(0),
  ...over,
});

describe('buildVisibleTree', () => {
  it('nests children and orders siblings by sortOrder, then name', () => {
    const tree = buildVisibleTree([
      cat('root', null),
      cat('b', 'root', { sortOrder: 1, name: 'B' }),
      cat('a', 'root', { sortOrder: 1, name: 'A' }),
      cat('z', 'root', { sortOrder: 0, name: 'Z' }),
      cat('leaf', 'a'),
    ]);

    expect(tree).toHaveLength(1);
    expect(tree[0].children.map((c) => c.id)).toEqual(['z', 'a', 'b']);
    expect(tree[0].children[1].children.map((c) => c.id)).toEqual(['leaf']);
  });

  it('drops a hidden category together with its whole subtree', () => {
    const tree = buildVisibleTree([
      cat('root', null),
      cat('hidden', 'root', { isVisible: false }),
      cat('kid', 'hidden'),
    ]);
    expect(tree[0].children).toEqual([]);
  });
});

describe('isEffectivelyVisible', () => {
  const all = [cat('root', null, { isVisible: false }), cat('kid', 'root'), cat('other', null)];
  const byId = new Map(all.map((c) => [c.id, c]));

  it('is false when any ancestor is hidden, or the id is unknown', () => {
    expect(isEffectivelyVisible('kid', byId)).toBe(false);
    expect(isEffectivelyVisible('missing', byId)).toBe(false);
  });

  it('is true when the category and all ancestors are visible', () => {
    expect(isEffectivelyVisible('other', byId)).toBe(true);
  });
});
