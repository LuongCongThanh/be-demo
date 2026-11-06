import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiErrorResponses } from '#src/common/swagger/api-error-responses.decorator.js';
import { API_TAGS } from '#src/common/swagger/api-tags.js';
import { JwtAuthGuard } from '#src/auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '#src/auth/guards/roles.guard.js';
import { Roles } from '#src/auth/decorators/roles.decorator.js';
import { CurrentUser } from '#src/auth/decorators/current-user.decorator.js';
import type { JwtPayload } from '#src/modules/identity/strategies/jwt.strategy.js';
import { PaginationDto } from '#src/common/pagination/pagination.dto.js';
import { StaffService } from '#src/modules/identity/services/internal-account/staff.service.js';
import { CreateStaffDto } from '#src/modules/identity/dto/staff/create-staff.dto.js';
import { UpdateStaffDto } from '#src/modules/identity/dto/staff/update-staff.dto.js';
import { StaffResponseDto } from '#src/modules/identity/dto/staff/staff-response.dto.js';
import { PaginatedStaffResponseDto } from '#src/modules/identity/dto/staff/paginated-staff-response.dto.js';

@ApiTags(API_TAGS.STAFF.name)
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/staff')
export class AdminStaffController {
  constructor(private readonly staffService: StaffService) {}

  @Get()
  @ApiOperation({ summary: 'List staff accounts, newest first (ADMIN only)' })
  @ApiOkResponse({ type: PaginatedStaffResponseDto })
  @ApiErrorResponses(400, 401, 403)
  findAll(@Query() pagination: PaginationDto) {
    return this.staffService.findAll(pagination);
  }

  @Post()
  @ApiOperation({ summary: 'Create a staff account with an initial password (ADMIN only)' })
  @ApiCreatedResponse({ type: StaffResponseDto })
  @ApiErrorResponses(400, 401, 403, [409, 'Email is already in use'])
  create(@Body() dto: CreateStaffDto, @CurrentUser() user: JwtPayload) {
    return this.staffService.create(dto, user.sub);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Rename a staff account (ADMIN only)' })
  @ApiOkResponse({ type: StaffResponseDto })
  @ApiErrorResponses(400, 401, 403, [404, 'Staff account not found'])
  rename(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateStaffDto, @CurrentUser() user: JwtPayload) {
    return this.staffService.rename(id, dto, user.sub);
  }

  @Post(':id/disable')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Disable a staff account and end all its sessions immediately; idempotent (ADMIN only)' })
  @ApiOkResponse({ type: StaffResponseDto })
  @ApiErrorResponses(400, 401, 403, [404, 'Staff account not found'])
  disable(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.staffService.disable(id, user.sub);
  }

  @Post(':id/enable')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Re-enable a disabled staff account; idempotent (ADMIN only)' })
  @ApiOkResponse({ type: StaffResponseDto })
  @ApiErrorResponses(400, 401, 403, [404, 'Staff account not found'])
  enable(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.staffService.enable(id, user.sub);
  }
}
