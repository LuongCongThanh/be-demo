import { ApiProperty } from '@nestjs/swagger';

export class ColorResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'WHT' })
  code: string;

  @ApiProperty({ example: 'Trắng' })
  name: string;

  @ApiProperty({ example: '#FFFFFF' })
  hex: string;

  @ApiProperty()
  isHidden: boolean;
}
