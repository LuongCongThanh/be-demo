import { ApiProperty } from '@nestjs/swagger';
import { VoucherType } from '#src/generated/prisma/enums.js';
import { VOUCHER_STATUSES, type VoucherStatus } from '#src/modules/voucher/voucher-status.js';

export class VoucherResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'SALE10', description: 'Upper case, immutable' })
  code: string;

  @ApiProperty({ enum: VoucherType, enumName: 'VoucherType' })
  type: VoucherType;

  @ApiProperty({ description: 'PERCENT: 1–100; FIXED: integer VND', example: 10 })
  value: number;

  @ApiProperty({ nullable: true, type: Number, description: 'PERCENT only; cap in VND, null = no cap', example: 50000 })
  maxDiscount: number | null;

  @ApiProperty({ description: 'Minimum Subtotal in VND, 0 = none', example: 300000 })
  minSubtotal: number;

  @ApiProperty({ nullable: true, type: Number, description: 'Total uses, null = unlimited', example: 100 })
  totalLimit: number | null;

  @ApiProperty({
    nullable: true,
    type: Number,
    description: 'Uses per Buyer (account or phone), null = unlimited',
    example: 1,
  })
  perBuyerLimit: number | null;

  @ApiProperty({ description: 'Uses counted so far (orders arrive in slice C)', example: 0 })
  usedCount: number;

  @ApiProperty({ format: 'date-time' })
  startsAt: Date;

  @ApiProperty({ format: 'date-time', description: 'Exclusive end' })
  endsAt: Date;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty({ enum: VOUCHER_STATUSES, enumName: 'VoucherStatus', description: 'At request time' })
  status: VoucherStatus;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
