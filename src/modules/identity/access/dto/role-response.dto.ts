import { ApiProperty } from '@nestjs/swagger';
import { Permission } from '#src/common/auth/permission.enum.js';
import { PaginationMetaDto } from '#src/common/pagination/pagination-meta.dto.js';

export class RoleResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ nullable: true, type: String })
  description: string | null;

  @ApiProperty({ description: 'System roles (Admin, Staff) cannot be deleted or renamed' })
  isSystem: boolean;

  @ApiProperty({ enum: Permission, enumName: 'Permission', isArray: true })
  permissions: Permission[];

  @ApiProperty({ description: 'Number of accounts currently holding this role' })
  accountCount: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class PaginatedRoleResponseDto {
  @ApiProperty({ type: [RoleResponseDto] })
  data: RoleResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta: PaginationMetaDto;
}
