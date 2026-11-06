/**
 * Nguồn duy nhất cho tag Swagger: `@ApiTags(API_TAGS.X.name)` ở controller và
 * `addTag(name, description)` trong `setup-swagger.ts` đều đọc từ đây, nên
 * không thể lệch chuỗi (lệch thì Swagger mất mô tả mà không báo lỗi).
 */
export const API_TAGS = {
  AUTH: {
    name: 'Authentication & Authorization',
    description: 'Register, email verification, login/refresh/logout, and role/ownership-based access control',
  },
  CATEGORIES: {
    name: 'Categories',
    description: 'Product category CRUD — writes gated to ADMIN, reads public',
  },
  PRODUCTS: {
    name: 'Products',
    description:
      'Product + variant CRUD (variants nested under products, inventory created atomically) — writes gated to ADMIN, reads public',
  },
  HEALTH: {
    name: 'Health',
    description: 'Liveness/readiness probes — public, readiness depends on Postgres only',
  },
} as const;
