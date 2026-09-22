import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, Min, ValidateIf } from 'class-validator';
import { VariantStatus } from '../../generated/prisma/enums.js';
import { CreateVariantDto } from './create-variant.dto.js';

export class UpdateVariantDto extends PartialType(CreateVariantDto) {
  // Override `sku`/`price` thay vì để nguyên field @IsOptional() PartialType tự
  // sinh — cùng lý do đã áp dụng ở UpdateCategoryDto: @IsOptional() coi `null`
  // như "absent" nên { "sku": null } / { "price": null } lọt qua validation rồi
  // Prisma từ chối `null` cho cột NOT NULL bằng PrismaClientValidationError,
  // rơi xuống 500 thay vì 400 vì AllExceptionsFilter chỉ map được
  // PrismaClientKnownRequestError.
  @ApiPropertyOptional({
    maxLength: 100,
    description: 'Client tự đặt theo quy ước riêng của store — không tự sinh',
    example: 'TSHIRT-BLK-M',
  })
  @ValidateIf((_, value) => value !== undefined)
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  declare sku?: string;

  @ApiPropertyOptional({ example: 199000 })
  @ValidateIf((_, value) => value !== undefined)
  @IsNotEmpty()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  declare price?: number;

  @ApiPropertyOptional({ enum: VariantStatus, example: VariantStatus.INACTIVE })
  @IsOptional()
  @IsEnum(VariantStatus)
  status?: VariantStatus;
}
