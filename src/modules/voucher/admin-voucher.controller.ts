import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Authorize } from '#src/common/auth/authorize.decorator.js';
import { CurrentUser } from '#src/common/auth/current-user.decorator.js';
import type { JwtPayload } from '#src/common/auth/jwt-payload.js';
import { Permission } from '#src/common/auth/permission.enum.js';
import { ApiErrorResponses } from '#src/common/swagger/api-error-responses.decorator.js';
import { API_TAGS } from '#src/common/swagger/api-tags.js';
import { AdminVoucherService } from '#src/modules/voucher/admin-voucher.service.js';
import { CreateVoucherDto } from '#src/modules/voucher/dto/create-voucher.dto.js';
import { ListVouchersQueryDto } from '#src/modules/voucher/dto/list-vouchers-query.dto.js';
import { PaginatedVoucherResponseDto } from '#src/modules/voucher/dto/paginated-voucher-response.dto.js';
import { UpdateVoucherDto } from '#src/modules/voucher/dto/update-voucher.dto.js';
import { VoucherResponseDto } from '#src/modules/voucher/dto/voucher-response.dto.js';

const NOT_FOUND: [404, string] = [404, 'Voucher not found'];

/** Voucher (US-901): đọc cần PRICING_VOUCHER_VIEW, ghi cần PRICING_VOUCHER_MANAGE. */
@ApiTags(API_TAGS.VOUCHERS.name)
@Authorize(Permission.PRICING_VOUCHER_VIEW)
@Controller('admin/vouchers')
export class AdminVoucherController {
  constructor(private readonly service: AdminVoucherService) {}

  @Get()
  @ApiOperation({ summary: 'List vouchers, newest first; search by code, filter by status now' })
  @ApiOkResponse({ type: PaginatedVoucherResponseDto })
  @ApiErrorResponses(400, 401, 403)
  findAll(@Query() query: ListVouchersQueryDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a voucher with its use count' })
  @ApiOkResponse({ type: VoucherResponseDto })
  @ApiErrorResponses(400, 401, 403, NOT_FOUND)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @Authorize(Permission.PRICING_VOUCHER_MANAGE)
  @ApiOperation({ summary: 'Create a voucher; the code is stored upper case and never changes' })
  @ApiCreatedResponse({ type: VoucherResponseDto })
  @ApiErrorResponses(400, 401, 403, [409, 'Code already exists'])
  create(@Body() dto: CreateVoucherDto, @CurrentUser() user: JwtPayload) {
    return this.service.create(dto, user.sub);
  }

  @Patch(':id')
  @Authorize(Permission.PRICING_VOUCHER_MANAGE)
  @ApiOperation({
    summary: 'Change a voucher',
    description:
      'Unused: any field but the code. Used: only endsAt, totalLimit (not below usedCount), perBuyerLimit, isActive.',
  })
  @ApiOkResponse({ type: VoucherResponseDto })
  @ApiErrorResponses(400, 401, 403, NOT_FOUND, [409, 'Field locked after first use'])
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateVoucherDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @Authorize(Permission.PRICING_VOUCHER_MANAGE)
  @ApiOperation({ summary: 'Delete an unused voucher; a used one can only be deactivated' })
  @ApiNoContentResponse()
  @ApiErrorResponses(400, 401, 403, NOT_FOUND, [409, 'Already used'])
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
