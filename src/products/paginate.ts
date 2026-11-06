export interface Paginated<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

/**
 * Offset pagination dùng chung cho các listing của catalog. `orderBy` luôn có
 * tie-breaker `id` để thứ tự giữa các trang ổn định.
 */
export async function paginate<T>(
  page: number,
  limit: number,
  findMany: (args: { skip: number; take: number; orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] }) => Promise<T[]>,
  count: () => Promise<number>,
): Promise<Paginated<T>> {
  const [data, total] = await Promise.all([
    findMany({ skip: (page - 1) * limit, take: limit, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] }),
    count(),
  ]);
  return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}
