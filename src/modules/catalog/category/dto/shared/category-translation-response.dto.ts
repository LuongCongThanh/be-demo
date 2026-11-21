import { ApiProperty } from '@nestjs/swagger';
import { CategoryTranslationStatus } from '#src/generated/prisma/enums.js';

export class CategoryTranslationResponseDto {
  @ApiProperty({ example: 'en' })
  locale: string;

  @ApiProperty({ nullable: true, example: 'T-shirts' })
  name: string | null;

  @ApiProperty({ enum: CategoryTranslationStatus, enumName: 'CategoryTranslationStatus' })
  status: CategoryTranslationStatus;

  @ApiProperty()
  updatedAt: Date;
}
