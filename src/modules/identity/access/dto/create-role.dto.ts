import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { ArrayUnique, IsArray, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { Permission } from '#src/common/auth/permission.enum.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateRoleDto {
  @ApiProperty({ example: 'Warehouse', description: 'Unique, case-insensitive' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ example: 'Can view the catalog' })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @ApiProperty({
    enum: Permission,
    enumName: 'Permission',
    isArray: true,
    example: [Permission.CATALOG_PRODUCT_VIEW],
    description: 'Permissions ticked for this role (may be empty)',
  })
  @IsArray()
  @ArrayUnique()
  @IsEnum(Permission, { each: true })
  permissions!: Permission[];
}
