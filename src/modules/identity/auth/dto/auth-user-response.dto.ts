import { ApiProperty } from '@nestjs/swagger';
import { Permission } from '#src/common/auth/permission.enum.js';
import { AccountType } from '#src/generated/prisma/enums.js';

export class AuthUserResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  fullName: string;

  @ApiProperty({ enum: AccountType, enumName: 'AccountType', example: AccountType.CUSTOMER })
  role: AccountType;

  @ApiProperty()
  emailVerified: boolean;
}

/** `GET /auth/me`: thêm Vai trò + Quyền (lấy từ access token); login giữ `AuthUserResponseDto`. */
export class MeResponseDto extends AuthUserResponseDto {
  @ApiProperty({ type: [String], example: ['Staff'], description: 'Names of the RBAC roles assigned to the account' })
  roles: string[];

  @ApiProperty({
    enum: Permission,
    enumName: 'Permission',
    isArray: true,
    example: [Permission.CATALOG_PRODUCT_VIEW],
    description: 'Union of the permissions granted by the account roles (empty for customers)',
  })
  permissions: Permission[];
}
