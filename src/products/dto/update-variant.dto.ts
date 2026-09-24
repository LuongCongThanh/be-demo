import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, Min, ValidateIf } from 'class-validator';
import { VariantStatus } from '../../generated/prisma/enums.js';

// Field sửa được của variant đã tồn tại. Option Value (màu/size) không nằm
// đây — chúng định nghĩa variant và không bao giờ đổi (docs/adr/0011).
export class UpdateVariantDto {
  // `@ValidateIf(!== undefined)` thay vì `@IsOptional()`: @IsOptional() coi
  // `null` như "absent" nên { "price": null } lọt qua validation rồi Prisma
  // từ chối `null` cho cột NOT NULL bằng PrismaClientValidationError, rơi
  // xuống 500 thay vì 400 vì AllExceptionsFilter chỉ map được
  // PrismaClientKnownRequestError.
  @ApiPropertyOptional({ example: 199000 })
  @ValidateIf((_, value) => value !== undefined)
  @IsNotEmpty()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price?: number;

  @ApiPropertyOptional({ enum: VariantStatus, example: VariantStatus.INACTIVE })
  @IsOptional()
  @IsEnum(VariantStatus)
  status?: VariantStatus;
}
