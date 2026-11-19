import { ApiProperty } from '@nestjs/swagger';

export class CategoryTreeNodeDto {
  @ApiProperty()
  nameVi: string;

  @ApiProperty({ nullable: true, type: String })
  nameEn: string | null;

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

  @ApiProperty({ type: () => [CategoryTreeNodeDto], description: 'Visible children ordered by sortOrder, then name' })
  children: CategoryTreeNodeDto[];
}
