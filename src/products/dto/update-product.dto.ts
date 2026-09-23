import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { ProductStatus } from '../../generated/prisma/enums.js';
import { CreateProductDto } from './create-product.dto.js';
import { UpdateVariantEntryDto } from './update-variant-entry.dto.js';
import { UpdateProductImageEntryDto } from './update-product-image-entry.dto.js';
import { MAX_PRODUCT_IMAGES } from './create-product-image.dto.js';
import { HasUniqueVariantSkus } from '../validators/unique-variant-skus.validator.js';

// `variants`/`images` bị omit khỏi base rồi khai lại riêng bên dưới — kiểu
// phần tử của PATCH (có `id` optional) không phải subtype của kiểu phần tử
// lúc tạo, nên không thể `declare` override trực tiếp field kế thừa từ
// PartialType(CreateProductDto) (TS2416).
export class UpdateProductDto extends PartialType(OmitType(CreateProductDto, ['variants', 'images'] as const)) {
  // Override `name` thay vì để nguyên field @IsOptional() PartialType tự sinh —
  // cùng lý do đã áp dụng ở UpdateCategoryDto: @IsOptional() coi `null` như
  // "absent" nên { "name": null } lọt qua validation rồi Prisma từ chối `null`
  // cho cột NOT NULL bằng PrismaClientValidationError, rơi xuống 500 thay vì
  // 400 vì AllExceptionsFilter chỉ map được PrismaClientKnownRequestError.
  @ApiPropertyOptional({ maxLength: 255, example: 'Wireless Headphones' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @ValidateIf((_, value) => value !== undefined)
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  declare name?: string;

  @ApiPropertyOptional({ enum: ProductStatus, example: ProductStatus.INACTIVE })
  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  // Override `variants` kế thừa từ CreateProductDto (kiểu CreateVariantDto[])
  // — PATCH cần cho phép `id` (update/discontinue theo full-sync), CreateDto
  // không có khái niệm này. Không gửi field này = không đụng gì tới variants
  // hiện có (khác với gửi mảng rỗng = discontinue tất cả).
  @ApiPropertyOptional({
    type: [UpdateVariantEntryDto],
    description:
      'Full desired state của toàn bộ variants — bỏ trống field này = không đổi gì; gửi mảng = reconcile (update theo id, tạo mới nếu không id, discontinue variant vắng mặt)',
    example: [{ id: '550e8400-e29b-41d4-a716-446655440000', price: 179000 }],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateVariantEntryDto)
  @HasUniqueVariantSkus()
  variants?: UpdateVariantEntryDto[];

  // Cùng quy tắc full-sync với `variants` — xem docs/specs/03-products.md,
  // mục "Product Images contract". Khác variants: ảnh vắng mặt bị xoá hẳn
  // (không có commercial reference nào trỏ tới ảnh).
  @ApiPropertyOptional({
    type: [UpdateProductImageEntryDto],
    maxItems: MAX_PRODUCT_IMAGES,
    description:
      'Full desired state của toàn bộ ảnh — bỏ trống field này = không đổi gì; gửi mảng = { id } giữ ảnh cũ, { key } gắn ảnh mới, ảnh vắng mặt bị xoá. Thứ tự mảng là thứ tự hiển thị, phần tử đầu là Cover Image',
    example: [{ id: '550e8400-e29b-41d4-a716-446655440000' }, { key: 'tmp/product-image/new.jpg' }],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_PRODUCT_IMAGES)
  @ValidateNested({ each: true })
  @Type(() => UpdateProductImageEntryDto)
  images?: UpdateProductImageEntryDto[];
}
