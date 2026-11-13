import { ApiProperty } from '@nestjs/swagger';

export class SizeSummaryDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'M' })
  code: string;

  @ApiProperty({ example: 'Size M' })
  name: string;
}

export class ColorSummaryDto extends SizeSummaryDto {
  @ApiProperty({ example: '#FFFFFF' })
  hex: string;
}
