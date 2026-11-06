import { ApiProperty } from '@nestjs/swagger';

export class CategoryTreeNodeDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  slug: string;

  @ApiProperty({ type: () => [CategoryTreeNodeDto], description: 'Visible children ordered by sortOrder, then name' })
  children: CategoryTreeNodeDto[];
}
