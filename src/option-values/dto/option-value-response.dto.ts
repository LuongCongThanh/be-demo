import { ApiProperty } from '@nestjs/swagger';
import { OptionType } from '../../generated/prisma/enums.js';

export class OptionValueResponseDto {
  @ApiProperty({ example: '3f2504e0-4f89-41d3-9a0c-0305e82c3301' })
  id: string;

  @ApiProperty({ enum: OptionType, example: OptionType.COLOR })
  type: OptionType;

  @ApiProperty({ example: 'Đen' })
  name: string;

  @ApiProperty({ example: 'BLK' })
  code: string;

  @ApiProperty({ example: 0 })
  position: number;

  @ApiProperty({ example: false })
  hidden: boolean;

  @ApiProperty({ example: '2026-09-24T08:46:12.345Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-09-24T08:46:12.345Z' })
  updatedAt: Date;
}
