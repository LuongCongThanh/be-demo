import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Authorize } from '#src/common/auth/authorize.decorator.js';
import { CurrentUser } from '#src/common/auth/current-user.decorator.js';
import type { JwtPayload } from '#src/common/auth/jwt-payload.js';
import { Permission } from '#src/common/auth/permission.enum.js';
import { PaginationDto } from '#src/common/pagination/pagination.dto.js';
import { ApiErrorResponses } from '#src/common/swagger/api-error-responses.decorator.js';
import { API_TAGS } from '#src/common/swagger/api-tags.js';
import { AccessService } from '#src/modules/identity/access/access.service.js';
import { CreateRoleDto } from '#src/modules/identity/access/dto/create-role.dto.js';
import { UpdateRoleDto } from '#src/modules/identity/access/dto/update-role.dto.js';
import { PaginatedRoleResponseDto, RoleResponseDto } from '#src/modules/identity/access/dto/role-response.dto.js';
import { PermissionGroupResponseDto } from '#src/modules/identity/access/dto/permission-group-response.dto.js';
import { AccountRolesResponseDto } from '#src/modules/identity/access/dto/account-roles-response.dto.js';

const ROLE_CHANGE_ENDS_SESSIONS =
  'Accounts holding the role must log in again: their access tokens stop working and their refresh tokens are revoked.';

@ApiTags(API_TAGS.ACCESS.name)
@Authorize(Permission.ADMINISTRATION_ROLE_VIEW)
@Controller('admin')
export class AdminRoleController {
  constructor(private readonly access: AccessService) {}

  @Get('permissions')
  @ApiOperation({ summary: 'List every Permission, grouped by prefix (requires ADMINISTRATION_ROLE_VIEW)' })
  @ApiOkResponse({ type: [PermissionGroupResponseDto] })
  @ApiErrorResponses(401, 403)
  listPermissions() {
    return this.access.listPermissions();
  }

  @Get('roles')
  @ApiOperation({ summary: 'List roles with their permissions, by name (requires ADMINISTRATION_ROLE_VIEW)' })
  @ApiOkResponse({ type: PaginatedRoleResponseDto })
  @ApiErrorResponses(400, 401, 403)
  findAllRoles(@Query() pagination: PaginationDto) {
    return this.access.findAllRoles(pagination);
  }

  @Get('roles/:id')
  @ApiOperation({ summary: 'Get one role (requires ADMINISTRATION_ROLE_VIEW)' })
  @ApiOkResponse({ type: RoleResponseDto })
  @ApiErrorResponses(400, 401, 403, [404, 'Role not found'])
  findOneRole(@Param('id', ParseUUIDPipe) id: string) {
    return this.access.findOneRole(id);
  }

  @Post('roles')
  @Authorize(Permission.ADMINISTRATION_ROLE_MANAGE)
  @ApiOperation({ summary: 'Create a role with a set of permissions (requires ADMINISTRATION_ROLE_MANAGE)' })
  @ApiCreatedResponse({ type: RoleResponseDto })
  @ApiErrorResponses(400, 401, 403, [409, 'Role name is already in use'])
  createRole(@Body() dto: CreateRoleDto, @CurrentUser() user: JwtPayload) {
    return this.access.createRole(dto, user.sub);
  }

  @Patch('roles/:id')
  @Authorize(Permission.ADMINISTRATION_ROLE_MANAGE)
  @ApiOperation({
    summary: `Edit a role's description, name or permissions (requires ADMINISTRATION_ROLE_MANAGE). ${ROLE_CHANGE_ENDS_SESSIONS} The Admin role is read-only; system roles cannot be renamed.`,
  })
  @ApiOkResponse({ type: RoleResponseDto })
  @ApiErrorResponses(
    400,
    401,
    403,
    [404, 'Role not found'],
    [409, 'Name in use, Admin role is read-only, or system role rename'],
  )
  updateRole(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateRoleDto, @CurrentUser() user: JwtPayload) {
    return this.access.updateRole(id, dto, user.sub);
  }

  @Delete('roles/:id')
  @Authorize(Permission.ADMINISTRATION_ROLE_MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary:
      'Delete a role (requires ADMINISTRATION_ROLE_MANAGE). Rejected for system roles and for roles still assigned to accounts',
  })
  @ApiNoContentResponse({ description: 'Role deleted' })
  @ApiErrorResponses(400, 401, 403, [404, 'Role not found'], [409, 'System role, or role still assigned to accounts'])
  removeRole(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.access.removeRole(id, user.sub);
  }

  @Get('internal-accounts/:accountId/roles')
  @Authorize(Permission.ADMINISTRATION_INTERNAL_ACCOUNT_VIEW)
  @ApiOperation({
    summary: 'List the roles held by an internal account (requires ADMINISTRATION_INTERNAL_ACCOUNT_VIEW)',
  })
  @ApiOkResponse({ type: AccountRolesResponseDto })
  @ApiErrorResponses(400, 401, 403, [404, 'Internal account not found'])
  findAccountRoles(@Param('accountId', ParseUUIDPipe) accountId: string) {
    return this.access.findAccountRoles(accountId);
  }

  @Put('internal-accounts/:accountId/roles/:roleId')
  @Authorize(Permission.ADMINISTRATION_INTERNAL_ACCOUNT_MANAGE)
  @ApiOperation({
    summary: `Assign a role to an internal account; idempotent (requires ADMINISTRATION_INTERNAL_ACCOUNT_MANAGE). ${ROLE_CHANGE_ENDS_SESSIONS} The Admin role cannot be assigned to a second account.`,
  })
  @ApiOkResponse({ type: AccountRolesResponseDto })
  @ApiErrorResponses(
    400,
    401,
    403,
    [404, 'Internal account or role not found'],
    [409, 'Admin role is already assigned to another account'],
  )
  assignRole(
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Param('roleId', ParseUUIDPipe) roleId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.access.assignRole(accountId, roleId, user.sub);
  }

  @Delete('internal-accounts/:accountId/roles/:roleId')
  @Authorize(Permission.ADMINISTRATION_INTERNAL_ACCOUNT_MANAGE)
  @ApiOperation({
    summary: `Remove a role from an internal account (requires ADMINISTRATION_INTERNAL_ACCOUNT_MANAGE). ${ROLE_CHANGE_ENDS_SESSIONS} The sole active Admin cannot lose the Admin role.`,
  })
  @ApiOkResponse({ type: AccountRolesResponseDto })
  @ApiErrorResponses(
    400,
    401,
    403,
    [404, 'Internal account, role, or assignment not found'],
    [409, 'Sole active Admin cannot lose the Admin role'],
  )
  removeRoleFromAccount(
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Param('roleId', ParseUUIDPipe) roleId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.access.removeRoleFromAccount(accountId, roleId, user.sub);
  }
}
