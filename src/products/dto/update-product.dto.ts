import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';
import { ProductStatus } from '../../generated/prisma/enums.js';
import { CreateProductDto } from './create-product.dto.js';

export class UpdateProductDto extends PartialType(CreateProductDto) {
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
}
