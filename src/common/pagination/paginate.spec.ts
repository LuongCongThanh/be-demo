import { describe, expect, it, vi } from 'vitest';
import { paginate } from '#src/common/pagination/paginate.js';

describe('paginate', () => {
  it('computes skip/take from page and limit and builds the meta envelope', async () => {
    const findMany = vi.fn().mockResolvedValue(['a']);
    const result = await paginate(3, 20, findMany, async () => 41);

    expect(findMany).toHaveBeenCalledWith({ skip: 40, take: 20 });
    expect(result).toEqual({ data: ['a'], meta: { page: 3, limit: 20, total: 41, totalPages: 3 } });
  });

  it('reports zero pages for an empty result', async () => {
    const result = await paginate(
      1,
      20,
      async () => [],
      async () => 0,
    );
    expect(result.meta.totalPages).toBe(0);
  });
});
