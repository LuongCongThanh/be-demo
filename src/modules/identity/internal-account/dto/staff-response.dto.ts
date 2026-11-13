import { ApiProperty } from '@nestjs/swagger';
import { UserStatus } from '#src/generated/prisma/enums.js';
import { RoleSummaryResponseDto } from '#src/modules/identity/access/dto/account-roles-response.dto.js';

export class StaffResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ enum: UserStatus, enumName: 'UserStatus' })
  status: UserStatus;

  @ApiProperty({ type: [RoleSummaryResponseDto], description: 'RBAC roles assigned to the account, sorted by name' })
  roles: RoleSummaryResponseDto[];

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
