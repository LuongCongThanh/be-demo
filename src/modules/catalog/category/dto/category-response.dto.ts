import { ApiProperty } from '@nestjs/swagger';

export class CategoryResponseDto {
  @ApiProperty({ nullable: true, type: String })
  nameEn: string | null;

  @ApiProperty()
  nameVi: string;

  @ApiProperty({ enum: ['PENDING', 'TRANSLATED', 'MANUAL', 'REVIEW', 'FAILED'] })
  translationStatus: string;

  @ApiProperty({ nullable: true, type: String })
  thumbnailStorageKey: string | null;

  @ApiProperty({ nullable: true, type: String })
  bannerStorageKey: string | null;

  @ApiProperty({ nullable: true, type: String })
  thumbnailUrl: string | null;

  @ApiProperty({ nullable: true, type: String })
  bannerUrl: string | null;

  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  slug: string;

  @ApiProperty({ nullable: true, type: String })
  description: string | null;

  @ApiProperty({ nullable: true, type: String, description: 'null for a root category' })
  parentId: string | null;

  @ApiProperty()
  sortOrder: number;

  @ApiProperty()
  isVisible: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
