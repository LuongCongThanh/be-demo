export interface Paginated<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

/** Mặc định mới nhất trước; `id` là tie-breaker để thứ tự giữa các trang ổn định. */
export const NEWEST_FIRST = [{ createdAt: 'desc' }, { id: 'desc' }] as const;

/**
 * Offset pagination dùng chung (api-rules.md §R9): chạy `findMany` của trang
 * hiện tại song song với `count`, trả envelope `{ data, meta }`.
 */
export async function paginate<T>(
  page: number,
  limit: number,
  findMany: (args: { skip: number; take: number }) => Promise<T[]>,
  count: () => Promise<number>,
): Promise<Paginated<T>> {
  const [data, total] = await Promise.all([findMany({ skip: (page - 1) * limit, take: limit }), count()]);
  return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}
