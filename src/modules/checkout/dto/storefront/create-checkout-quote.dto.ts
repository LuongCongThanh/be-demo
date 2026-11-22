import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  MinLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class CheckoutLineInputDto {
  @ApiProperty({ example: '0193e4d4-0b53-7a8b-9f2d-c2a4dcab249f' })
  @IsUUID()
  variantId: string;

  @ApiProperty({ example: 2, minimum: 1, maximum: 10 })
  @IsInt()
  @Min(1)
  @Max(10)
  quantity: number;
}

export class CreateCheckoutQuoteDto {
  @ApiProperty({
    type: [CheckoutLineInputDto],
    example: [{ variantId: '0193e4d4-0b53-7a8b-9f2d-c2a4dcab249f', quantity: 2 }],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CheckoutLineInputDto)
  items: CheckoutLineInputDto[];

  @ApiProperty({ example: 'Nguyen Van A' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  contactName: string;

  @ApiProperty({ example: '0901234567' })
  @IsString()
  @MinLength(8)
  @Matches(/^[0-9+(). -]{8,30}$/)
  contactPhone: string;

  @ApiPropertyOptional({ example: 'buyer@example.com' })
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  contactEmail?: string;

  @ApiProperty({ example: '79' })
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  shippingProvinceCode: string;

  @ApiProperty({ example: '26734' })
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  shippingWardCode: string;

  @ApiProperty({ example: '123 Nguyen Hue, Ben Nghe' })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  shippingAddress: string;

  @ApiPropertyOptional({ example: 'SALE10' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  voucherCode?: string;
}
