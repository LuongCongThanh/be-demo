import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';
import { Gender, ProductStatus } from '#src/generated/prisma/enums.js';
import { CreateProductDto } from '#src/modules/catalog/product/dto/create-product.dto.js';

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

  // Cùng lý do với `name`: `{ "gender": null }` phải là 400, không phải 500.
  @ApiPropertyOptional({ enum: Gender, enumName: 'Gender', example: Gender.MEN })
  @ValidateIf((_, value) => value !== undefined)
  @IsEnum(Gender)
  declare gender?: Gender;

  @ApiPropertyOptional({
    enum: ProductStatus,
    enumName: 'ProductStatus',
    example: ProductStatus.ACTIVE,
    description: 'DRAFT → ACTIVE, ACTIVE ↔ ARCHIVED, DRAFT → ARCHIVED; never back to DRAFT',
  })
  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;
}
