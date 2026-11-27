import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, Min, MinLength } from 'class-validator';

export class AdjustInventoryDto {
  @ApiProperty({ example: -5 })
  @IsInt()
  delta: number;

  @ApiProperty({ example: 'Damaged stock count' })
  @IsString()
  @MinLength(3)
  reason: string;
}

export class CreateStockCountDto {
  @ApiProperty({ example: 48 })
  @IsInt()
  @Min(0)
  physicalCount: number;
}
