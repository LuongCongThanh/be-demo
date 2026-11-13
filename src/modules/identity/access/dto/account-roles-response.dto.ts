import { ApiProperty } from '@nestjs/swagger';

export class RoleSummaryResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  isSystem: boolean;
}

export class AccountRolesResponseDto {
  @ApiProperty()
  accountId: string;

  @ApiProperty({ type: [RoleSummaryResponseDto] })
  roles: RoleSummaryResponseDto[];
}
