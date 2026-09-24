import { ApiProperty } from '@nestjs/swagger';
import { OptionType } from '../../generated/prisma/enums.js';

export class OptionValueResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: OptionType })
  type: OptionType;

  @ApiProperty()
  name: string;

  @ApiProperty()
  code: string;

  @ApiProperty()
  position: number;

  @ApiProperty()
  hidden: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
