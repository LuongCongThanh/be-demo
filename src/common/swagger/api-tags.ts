/**
 * Nguồn duy nhất cho tag Swagger: `@ApiTags(API_TAGS.X.name)` ở controller và
 * `addTag(name, description)` trong `openapi.ts` đều đọc từ đây, nên
 * không thể lệch chuỗi (lệch thì Swagger mất mô tả mà không báo lỗi).
 */
export const API_TAGS = {
  STOREFRONT_AUTH: {
    name: 'Storefront — Authentication',
    description: 'Customer registration, email verification, login, sessions and profile',
  },
  STOREFRONT_CATEGORIES: {
    name: 'Storefront — Categories',
    description: 'Public category tree, category detail and enabled content languages',
  },
  ADMIN_CATEGORIES: {
    name: 'Admin CMS — Categories',
    description: 'Back-office category, translation, language and image management — reads STAFF/ADMIN, writes ADMIN',
  },
  STOREFRONT_PRODUCTS: {
    name: 'Storefront — Products',
    description: 'Public product listing, details and variants',
  },
  STOREFRONT_CHECKOUT: {
    name: 'Storefront — Checkout',
    description: 'Short-lived checkout quotes and idempotent COD/online order placement for guests and customers',
  },
  STOREFRONT_PAYMENTS: {
    name: 'Storefront — Payments',
    description: 'VNPay/MoMo payment attempts, verified provider notifications and reconciliation',
  },
  ADMIN_PRODUCTS: {
    name: 'Admin CMS — Products',
    description: 'Product and variant management — writes gated to ADMIN',
  },
  STOREFRONT_PRODUCT_OPTIONS: {
    name: 'Storefront — Sizes & Colors',
    description: 'Public size list and color palette used by product variants',
  },
  ADMIN_PRODUCT_OPTIONS: {
    name: 'Admin CMS — Sizes & Colors',
    description: 'Manage shared size lists and color palettes — writes gated to ADMIN',
  },
  ADMIN_SALE_PRICES: {
    name: 'Admin CMS — Sale prices',
    description:
      'Time-boxed sale prices per variant (no overlap per variant); upcoming editable, active only its end, ended read-only (needs PRICING_SALE_PRICE_*)',
  },
  ADMIN_VOUCHERS: {
    name: 'Admin CMS — Vouchers',
    description:
      'Order discount codes (percent with optional cap, or fixed amount); code immutable, locked fields after first use, delete only unused (needs PRICING_VOUCHER_*)',
  },
  ADMIN_STAFF: {
    name: 'Admin CMS — Staff Management',
    description:
      'Back-office staff accounts — create, rename, disable/enable (needs ADMINISTRATION_INTERNAL_ACCOUNT_* permissions, every change audited)',
  },
  ADMIN_ACCESS: {
    name: 'Admin CMS — Roles & Permissions',
    description:
      'Permission list, role CRUD and role assignment for internal accounts — the Admin role is read-only, role changes end the affected sessions, every change audited',
  },
  HEALTH: {
    name: 'Health',
    description: 'Liveness/readiness probes — public, readiness depends on Postgres only',
  },
} as const;
