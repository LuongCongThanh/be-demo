import { registerDecorator, ValidationOptions } from 'class-validator';
import { CreateVariantDto } from '../dto/create-variant.dto.js';

// Chặn SKU trùng ngay trong cùng 1 request (mảng variants của POST /products)
// ở tầng DTO — trả 400 rõ ràng trước khi mở transaction, thay vì để unique
// constraint của DB bắt sau khi đã ghi dở (xem docs/superpowers/specs
// 2026-09-18-products-and-variants-design.md, mục "Duplicate SKUs").
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
          const skus = (value as CreateVariantDto[]).map((v) => v?.sku).filter((sku) => typeof sku === 'string');
          return new Set(skus).size === skus.length;
        },
        defaultMessage(): string {
          return 'variants must not contain duplicate sku values';
        },
      },
    });
  };
}
