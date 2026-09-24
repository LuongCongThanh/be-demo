import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { CreateVariantDto } from './create-variant.dto.js';
import { CreateProductImageDto, MAX_PRODUCT_IMAGES } from './create-product-image.dto.js';

export const PRODUCT_CODE_PATTERN = /^[A-Z0-9]{2,20}$/;

export class CreateProductDto {
  @ApiProperty({ maxLength: 255, example: 'Wireless Headphones' })
  // Trim trước khi validate — tên chỉ gồm khoảng trắng phải bị @IsNotEmpty()
  // từ chối thay vì lọt qua rồi sinh slug rỗng (xem toSlug() trong service).
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  name: string;

  // Mở đầu mọi SKU của product, không đổi sau khi tạo (docs/adr/0011). Không
  // tự viết hoa — FE phải thấy đúng giá trị sẽ nằm trong SKU.
  @ApiProperty({ pattern: PRODUCT_CODE_PATTERN.source, example: 'TSB001' })
  @IsString()
  @Matches(PRODUCT_CODE_PATTERN, { message: 'code must be 2-20 uppercase letters or digits' })
  code: string;

  @ApiProperty({
    description: 'UUID của Category đã tồn tại',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsNotEmpty()
  @IsUUID()
  categoryId: string;

  // Không có field `slug` — server tự sinh từ `name` (Task 3). Không có
  // field `status` — mặc định ACTIVE ở DB, chỉ đổi được qua UpdateProductDto.

  @ApiPropertyOptional({
    type: [CreateVariantDto],
    description: 'Variants tạo kèm ngay khi tạo product (optional, mặc định rỗng)',
    example: [
      {
        colorId: '550e8400-e29b-41d4-a716-446655440000',
        sizeId: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
        price: 199000,
      },
    ],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateVariantDto)
  variants?: CreateVariantDto[];

  @ApiPropertyOptional({
    type: [CreateProductImageDto],
    maxItems: MAX_PRODUCT_IMAGES,
    description:
      'Ảnh tạo kèm product (key lấy từ POST /upload-images/presign) — thứ tự mảng là thứ tự hiển thị, phần tử đầu là Cover Image',
    example: [{ key: 'tmp/product-image/550e8400-e29b-41d4-a716-446655440000.jpg', altText: 'Front view' }],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_PRODUCT_IMAGES)
  @ValidateNested({ each: true })
  @Type(() => CreateProductImageDto)
  images?: CreateProductImageDto[];
}
