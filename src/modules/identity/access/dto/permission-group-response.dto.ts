import { ApiProperty } from '@nestjs/swagger';
import { Permission } from '#src/common/auth/permission.enum.js';

export class PermissionGroupResponseDto {
  @ApiProperty({ example: 'CATALOG', description: 'Prefix of the permission names' })
  group: string;

  @ApiProperty({ enum: Permission, enumName: 'Permission', isArray: true })
  permissions: Permission[];
}
