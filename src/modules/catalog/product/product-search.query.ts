import { Prisma } from '#src/generated/prisma/client.js';
import type { ListProductsQueryDto } from '#src/modules/catalog/product/dto/list-products-query.dto.js';

/**
 * SQL cho danh sách storefront. Prisma không sắp theo MIN() của quan hệ và
 * không gọi được `unaccent`, nên lọc + sắp + phân trang bằng raw SQL rồi
 * service đọc lại các dòng theo id.
 *
 * - Chỉ Sản phẩm ACTIVE có ít nhất một Biến thể ACTIVE (không có gì để mua thì không hiện).
 * - Giá của Sản phẩm = giá thấp nhất trong các Biến thể ACTIVE; lọc và sắp theo giá này.
 * - Lọc size/màu: ít nhất MỘT Biến thể ACTIVE thoả cả hai cùng lúc; size/màu đã ẩn không lọc ra gì.
 * - Tìm kiếm: chuỗi con của tên, không phân biệt hoa thường và dấu (BR-CAT-13).
 */
export function productSearchSql({
  categoryId,
  q,
  size,
  color,
  minPrice,
  maxPrice,
  sort = 'newest',
}: ListProductsQueryDto) {
  const conditions: Prisma.Sql[] = [Prisma.sql`p.status = 'ACTIVE'`];
  if (categoryId) {
    conditions.push(Prisma.sql`p.category_id = ${categoryId}::uuid`);
  }
  if (q) {
    conditions.push(Prisma.sql`unaccent(lower(p.name)) LIKE '%' || unaccent(lower(${escapeLike(q)})) || '%'`);
  }
  if (size?.length || color?.length) {
    conditions.push(Prisma.sql`EXISTS (
      SELECT 1 FROM product_variants fv
      JOIN sizes s ON s.id = fv.size_id
      JOIN colors c ON c.id = fv.color_id
      WHERE fv.product_id = p.id AND fv.status = 'ACTIVE'
      ${size?.length ? Prisma.sql`AND s.code IN (${Prisma.join(size)}) AND NOT s.is_hidden` : Prisma.empty}
      ${color?.length ? Prisma.sql`AND c.code IN (${Prisma.join(color)}) AND NOT c.is_hidden` : Prisma.empty}
    )`);
  }

  const having: Prisma.Sql[] = [];
  if (minPrice !== undefined) having.push(Prisma.sql`MIN(v.price) >= ${minPrice}`);
  if (maxPrice !== undefined) having.push(Prisma.sql`MIN(v.price) <= ${maxPrice}`);

  const priced = Prisma.sql`
    SELECT p.id, p.created_at, MIN(v.price) AS min_price, MAX(v.price) AS max_price
    FROM products p
    JOIN product_variants v ON v.product_id = p.id AND v.status = 'ACTIVE'
    WHERE ${Prisma.join(conditions, ' AND ')}
    GROUP BY p.id
    ${having.length ? Prisma.sql`HAVING ${Prisma.join(having, ' AND ')}` : Prisma.empty}`;

  return {
    page: (skip: number, take: number) => Prisma.sql`
      SELECT id, min_price AS "minPrice", max_price AS "maxPrice" FROM (${priced}) priced
      ORDER BY ${ORDER_BY[sort]}
      LIMIT ${take} OFFSET ${skip}`,
    count: Prisma.sql`SELECT COUNT(*)::int AS total FROM (${priced}) priced`,
  };
}

// `id` là tie-breaker để thứ tự giữa các trang ổn định.
const ORDER_BY = {
  newest: Prisma.sql`created_at DESC, id DESC`,
  price_asc: Prisma.sql`min_price ASC, created_at DESC, id DESC`,
  price_desc: Prisma.sql`min_price DESC, created_at DESC, id DESC`,
} as const;

// `%` và `_` trong từ khoá là ký tự thường, không phải wildcard.
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}
