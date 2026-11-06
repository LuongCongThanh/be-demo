import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { IsOptionCode } from '#src/product-options/dto/option-code.decorator.js';

export class CreateColorDto {
  @IsOptionCode('WHT')
  code!: string;

  @ApiProperty({ maxLength: 50, example: 'Trắng' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name!: string;

  @ApiProperty({ pattern: '^#[0-9A-Fa-f]{6}$', example: '#FFFFFF' })
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'hex must be a #RRGGBB colour' })
  hex!: string;

  @ApiPropertyOptional({ default: false, example: false })
  @IsOptional()
  @IsBoolean()
  isHidden?: boolean;
}
