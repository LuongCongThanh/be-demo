/**
 * Quyền (Permission): danh sách cố định, chỉ đổi khi phát hành phiên bản mới (GLOSSARY).
 * Nhóm logic theo tiền tố: CATALOG_*, PRICING_*, OPERATIONS_*, ADMINISTRATION_*. Giá trị lưu trong
 * `role_permissions.permission` đúng bằng chuỗi này; API không nhận chuỗi tuỳ ý.
 *
 * Hiện chưa có route Vận hành nào (đơn hàng, tồn kho... đến ở slice C), nên chưa có OPERATIONS_*.
 * Thêm Quyền mới = thêm giá trị ở đây + migration cấp cho Vai trò `Admin` (seed cũng đồng bộ lại).
 */
export enum Permission {
  // Catalog — admin/products
  CATALOG_PRODUCT_VIEW = 'CATALOG_PRODUCT_VIEW',
  CATALOG_PRODUCT_MANAGE = 'CATALOG_PRODUCT_MANAGE',
  // Catalog — admin/categories
  CATALOG_CATEGORY_VIEW = 'CATALOG_CATEGORY_VIEW',
  CATALOG_CATEGORY_MANAGE = 'CATALOG_CATEGORY_MANAGE',
  // Catalog — admin/sizes, admin/colors
  CATALOG_PRODUCT_OPTION_VIEW = 'CATALOG_PRODUCT_OPTION_VIEW',
  CATALOG_PRODUCT_OPTION_MANAGE = 'CATALOG_PRODUCT_OPTION_MANAGE',

  // Pricing — Giá khuyến mãi (admin/products/:id/sale-prices, admin/sale-prices)
  PRICING_SALE_PRICE_VIEW = 'PRICING_SALE_PRICE_VIEW',
  PRICING_SALE_PRICE_MANAGE = 'PRICING_SALE_PRICE_MANAGE',

  // Administration — Vai trò (liệt kê Quyền, CRUD Vai trò)
  ADMINISTRATION_ROLE_VIEW = 'ADMINISTRATION_ROLE_VIEW',
  ADMINISTRATION_ROLE_MANAGE = 'ADMINISTRATION_ROLE_MANAGE',
  // Administration — Tài khoản nội bộ (admin/staff hiện tại; gán Vai trò cho tài khoản)
  ADMINISTRATION_INTERNAL_ACCOUNT_VIEW = 'ADMINISTRATION_INTERNAL_ACCOUNT_VIEW',
  ADMINISTRATION_INTERNAL_ACCOUNT_MANAGE = 'ADMINISTRATION_INTERNAL_ACCOUNT_MANAGE',
}

/** Quyền của Vai trò hệ thống `Staff`: giữ đúng hành vi hiện tại (Staff chỉ đọc catalog). */
export const STAFF_ROLE_PERMISSIONS: readonly Permission[] = [
  Permission.CATALOG_PRODUCT_VIEW,
  Permission.CATALOG_CATEGORY_VIEW,
  Permission.CATALOG_PRODUCT_OPTION_VIEW,
];

/** Vai trò hệ thống `Admin` luôn bằng toàn bộ enum. */
export const ADMIN_ROLE_PERMISSIONS: readonly Permission[] = Object.values(Permission);
