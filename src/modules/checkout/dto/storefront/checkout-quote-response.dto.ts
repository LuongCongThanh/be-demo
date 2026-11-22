import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CheckoutQuoteLineDto {
  @ApiProperty()
  variantId: string;

  @ApiProperty()
  productName: string;

  @ApiProperty()
  sku: string;

  @ApiProperty()
  sizeName: string;

  @ApiProperty()
  colorName: string;

  @ApiProperty()
  quantity: number;

  @ApiProperty()
  listPrice: number;

  @ApiProperty()
  unitPrice: number;

  @ApiProperty()
  lineTotal: number;

  @ApiProperty()
  availableQuantity: number;
}

export class CheckoutQuoteResponseDto {
  @ApiProperty()
  quoteId: string;

  @ApiProperty({ type: [CheckoutQuoteLineDto] })
  items: CheckoutQuoteLineDto[];

  @ApiProperty()
  subtotal: number;

  @ApiProperty()
  discount: number;

  @ApiProperty()
  shippingFee: number;

  @ApiProperty()
  shippingFeeFallback: boolean;

  @ApiProperty()
  total: number;

  @ApiProperty()
  codAllowed: boolean;

  @ApiPropertyOptional()
  voucherCode?: string;

  @ApiProperty()
  expiresAt: Date;
}
