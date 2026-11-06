import { ApiProperty } from '@nestjs/swagger';

export class SizeResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'M' })
  code: string;

  @ApiProperty({ example: 'Size M' })
  name: string;

  @ApiProperty({ example: 20 })
  sortOrder: number;

  @ApiProperty()
  isHidden: boolean;
}
