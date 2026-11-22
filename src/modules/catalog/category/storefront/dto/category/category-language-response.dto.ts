import { ApiProperty } from '@nestjs/swagger';

export class CategoryLanguageResponseDto {
  @ApiProperty({ example: 'en' })
  locale: string;

  @ApiProperty({ example: true })
  enabled: boolean;

  @ApiProperty({ example: 1 })
  generation: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
