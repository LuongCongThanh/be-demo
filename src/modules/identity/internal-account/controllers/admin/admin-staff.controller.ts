import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Authorize } from '#src/security/authorization/permissions/authorize.decorator.js';
import { Permission } from '#src/security/contracts/permission.enum.js';
import { ApiErrorResponses } from '#src/common/swagger/api-error-responses.decorator.js';
import { API_TAGS } from '#src/common/swagger/api-tags.js';
import { CurrentUser } from '#src/security/authentication/current-user.decorator.js';
import type { JwtPayload } from '#src/security/contracts/jwt-payload.js';
import { PaginationDto } from '#src/common/pagination/pagination.dto.js';
import { InternalAccountService } from '#src/modules/identity/internal-account.service.js';
import { CreateStaffDto } from '#src/modules/identity/internal-account/dto/admin/create-staff.dto.js';
import { UpdateStaffDto } from '#src/modules/identity/internal-account/dto/admin/update-staff.dto.js';
import { StaffResponseDto } from '#src/modules/identity/internal-account/dto/admin/staff-response.dto.js';
import { PaginatedStaffResponseDto } from '#src/modules/identity/internal-account/dto/admin/paginated-staff-response.dto.js';

@ApiTags(API_TAGS.ADMIN_STAFF.name)
@Authorize(Permission.ADMINISTRATION_INTERNAL_ACCOUNT_VIEW)
@Controller('admin/staff')
export class AdminStaffController {
  constructor(private readonly internalAccounts: InternalAccountService) {}

  @Get()
  @ApiOperation({ summary: 'List staff accounts, newest first (requires ADMINISTRATION_INTERNAL_ACCOUNT_VIEW)' })
  @ApiOkResponse({ type: PaginatedStaffResponseDto })
  @ApiErrorResponses(400, 401, 403)
  findAll(@Query() pagination: PaginationDto) {
    return this.internalAccounts.findAllStaff(pagination);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one staff account with its roles (requires ADMINISTRATION_INTERNAL_ACCOUNT_VIEW)' })
  @ApiOkResponse({ type: StaffResponseDto })
  @ApiErrorResponses(400, 401, 403, [404, 'Staff account not found'])
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.internalAccounts.findOneStaff(id);
  }

  @Post()
  @Authorize(Permission.ADMINISTRATION_INTERNAL_ACCOUNT_MANAGE)
  @ApiOperation({
    summary: 'Create a staff account with an initial password (requires ADMINISTRATION_INTERNAL_ACCOUNT_MANAGE)',
  })
  @ApiCreatedResponse({ type: StaffResponseDto })
  @ApiErrorResponses(400, 401, 403, [409, 'Email is already in use'])
  create(@Body() dto: CreateStaffDto, @CurrentUser() user: JwtPayload) {
    return this.internalAccounts.createStaff(dto, user.sub);
  }

  @Patch(':id')
  @Authorize(Permission.ADMINISTRATION_INTERNAL_ACCOUNT_MANAGE)
  @ApiOperation({ summary: 'Rename a staff account (requires ADMINISTRATION_INTERNAL_ACCOUNT_MANAGE)' })
  @ApiOkResponse({ type: StaffResponseDto })
  @ApiErrorResponses(400, 401, 403, [404, 'Staff account not found'])
  rename(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateStaffDto, @CurrentUser() user: JwtPayload) {
    return this.internalAccounts.renameStaff(id, dto, user.sub);
  }

  @Post(':id/disable')
  @Authorize(Permission.ADMINISTRATION_INTERNAL_ACCOUNT_MANAGE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Disable a staff account and end all its sessions immediately; idempotent (requires ADMINISTRATION_INTERNAL_ACCOUNT_MANAGE)',
  })
  @ApiOkResponse({ type: StaffResponseDto })
  @ApiErrorResponses(400, 401, 403, [404, 'Staff account not found'])
  disable(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.internalAccounts.disableStaff(id, user.sub);
  }

  @Post(':id/enable')
  @Authorize(Permission.ADMINISTRATION_INTERNAL_ACCOUNT_MANAGE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Re-enable a disabled staff account; idempotent (requires ADMINISTRATION_INTERNAL_ACCOUNT_MANAGE)',
  })
  @ApiOkResponse({ type: StaffResponseDto })
  @ApiErrorResponses(400, 401, 403, [404, 'Staff account not found'])
  enable(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.internalAccounts.enableStaff(id, user.sub);
  }
}
