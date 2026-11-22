import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class PlaceCodOrderDto {
  @ApiProperty({ example: '0193e4d4-0b53-7a8b-9f2d-c2a4dcab249f' })
  @IsUUID()
  quoteId: string;
}
