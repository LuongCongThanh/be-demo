import { ApiProperty } from '@nestjs/swagger';

export class ImageResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  productId: string;

  @ApiProperty()
  colorId: string;

  @ApiProperty()
  storageKey: string;

  @ApiProperty({ nullable: true, type: String })
  altText: string | null;

  @ApiProperty()
  sortOrder: number;

  @ApiProperty()
  isPrimary: boolean;

  @ApiProperty()
  createdAt: Date;
}
