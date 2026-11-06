import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UpdateStaffDto {
  @ApiProperty({ example: 'Nguyen Van C' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;
}
