import { Prisma } from '#src/generated/prisma/client.js';
import type { Gender } from '#src/generated/prisma/enums.js';
import type { ListProductsQueryDto } from '#src/modules/catalog/product/dto/list-products-query.dto.js';

/**
 * SQL cho danh sách storefront. Prisma không sắp theo MIN() của quan hệ và
 * không gọi được `unaccent`, nên lọc + sắp + phân trang bằng raw SQL rồi
 * service đọc lại các dòng theo id.
 *
 * - Chỉ Sản phẩm ACTIVE có ít nhất một Biến thể ACTIVE (không có gì để mua thì không hiện).
 * - Giá của Sản phẩm = Giá áp dụng thấp nhất trong các Biến thể ACTIVE (BR-PRC-03); lọc và sắp theo giá này
 *   (US-102 AC3). Giá áp dụng = Giá khuyến mãi đang hiệu lực lúc `at`, ngược lại là Giá bán.
 * - `onSale`: có ít nhất một Biến thể ACTIVE đang có Giá khuyến mãi; `discount_desc` sắp theo mức giảm lớn nhất.
 * - Lọc size/màu: ít nhất MỘT Biến thể ACTIVE thoả cả hai cùng lúc; size/màu đã ẩn không lọc ra gì.
 * - Danh mục: gồm cả các danh mục con, cháu.
 * - Giới tính: MEN/WOMEN gộp cả UNISEX; KIDS thì không (BR-CAT-14).
 * - Tìm kiếm: chuỗi con của tên, không phân biệt hoa thường và dấu (BR-CAT-13).
 */
export function productSearchSql(
  { categoryId, gender, q, size, color, minPrice, maxPrice, onSale, sort = 'newest' }: ListProductsQueryDto,
  at: Date,
) {
  const conditions: Prisma.Sql[] = [Prisma.sql`p.status = 'ACTIVE'`];
  if (categoryId) {
    conditions.push(Prisma.sql`p.category_id IN (
      WITH RECURSIVE tree AS (
        SELECT id FROM categories WHERE id = ${categoryId}::uuid
        UNION
        SELECT c.id FROM categories c JOIN tree ON c.parent_id = tree.id
      )
      SELECT id FROM tree
    )`);
  }
  if (gender?.length) {
    conditions.push(
      Prisma.sql`p.gender IN (${Prisma.join(withUnisex(gender).map((g) => Prisma.sql`${g}::"Gender"`))})`,
    );
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
  const effective = Prisma.sql`COALESCE(sp.price, v.price)`;
  if (minPrice !== undefined) having.push(Prisma.sql`MIN(${effective}) >= ${minPrice}`);
  if (maxPrice !== undefined) having.push(Prisma.sql`MIN(${effective}) <= ${maxPrice}`);
  if (onSale) having.push(Prisma.sql`COUNT(sp.id) > 0`);

  // Mức giảm theo % làm tròn xuống, số nguyên (BR-PRC-04 dùng tỷ lệ chính xác; đây chỉ để hiển thị và sắp xếp).
  const priced = Prisma.sql`
    SELECT p.id, p.created_at,
      MIN(${effective}) AS min_price, MAX(${effective}) AS max_price, MIN(v.price) AS min_regular_price,
      COALESCE(MAX(((v.price - sp.price) * 100) / v.price), 0) AS max_discount_percent
    FROM products p
    JOIN product_variants v ON v.product_id = p.id AND v.status = 'ACTIVE'
    LEFT JOIN sale_prices sp ON sp.variant_id = v.id AND sp.starts_at <= ${at} AND sp.ends_at > ${at}
    WHERE ${Prisma.join(conditions, ' AND ')}
    GROUP BY p.id
    ${having.length ? Prisma.sql`HAVING ${Prisma.join(having, ' AND ')}` : Prisma.empty}`;

  return {
    page: (skip: number, take: number) => Prisma.sql`
      SELECT id, min_price AS "minPrice", max_price AS "maxPrice", min_regular_price AS "minRegularPrice",
        max_discount_percent AS "maxDiscountPercent"
      FROM (${priced}) priced
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
  discount_desc: Prisma.sql`max_discount_percent DESC, created_at DESC, id DESC`,
} as const;

function withUnisex(genders: Gender[]): Gender[] {
  const matched = new Set(genders);
  if (matched.has('MEN') || matched.has('WOMEN')) matched.add('UNISEX');
  return [...matched];
}

// `%` và `_` trong từ khoá là ký tự thường, không phải wildcard.
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}
