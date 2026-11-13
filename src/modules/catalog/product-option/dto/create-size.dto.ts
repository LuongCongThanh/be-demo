import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { IsOptionCode } from '#src/modules/catalog/product-option/option-code.decorator.js';

export class CreateSizeDto {
  @IsOptionCode('M')
  code!: string;

  @ApiProperty({ maxLength: 50, example: 'Size M' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name!: string;

  @ApiProperty({ minimum: 0, example: 20, description: 'Ascending display order on the storefront' })
  @IsInt()
  @Min(0)
  sortOrder!: number;

  @ApiPropertyOptional({ default: false, example: false })
  @IsOptional()
  @IsBoolean()
  isHidden?: boolean;
}
