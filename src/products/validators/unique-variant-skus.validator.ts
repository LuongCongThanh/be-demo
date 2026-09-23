import { registerDecorator, ValidationOptions } from 'class-validator';

// Chặn SKU trùng ngay trong cùng 1 request — dùng cho cả mảng `variants` của
// POST /products (CreateVariantDto[]) và PATCH /products/:id
// (UpdateVariantEntryDto[]) — trả 400 rõ ràng trước khi mở transaction, thay
// vì để unique constraint của DB bắt sau khi đã ghi dở (xem docs/superpowers/
// specs 2026-09-18-products-and-variants-design.md, mục "Duplicate SKUs").
// Chỉ đọc field `sku` nên dùng chung được cho cả 2 kiểu phần tử.
export function HasUniqueVariantSkus(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'hasUniqueVariantSkus',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          if (!Array.isArray(value)) return true;
          const skus = (value as { sku?: string }[]).map((v) => v?.sku).filter((sku) => typeof sku === 'string');
          return new Set(skus).size === skus.length;
        },
        defaultMessage(): string {
          return 'variants must not contain duplicate sku values';
        },
      },
    });
  };
}
