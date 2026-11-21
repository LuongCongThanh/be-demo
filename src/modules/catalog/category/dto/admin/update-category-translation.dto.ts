import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength, ValidateIf } from 'class-validator';

export class UpdateCategoryTranslationDto {
  @ApiProperty({ nullable: true, example: 'T-shirts' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name!: string | null;
}
