import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Authorize } from '#src/security/authorization/permissions/authorize.decorator.js';
import { Permission } from '#src/security/contracts/permission.enum.js';
import { CurrentUser } from '#src/security/authentication/current-user.decorator.js';
import type { JwtPayload } from '#src/security/contracts/jwt-payload.js';
import { AdminInventoryService } from '#src/modules/inventory/application/admin-inventory.service.js';
import { AdjustInventoryDto, CreateStockCountDto } from '#src/modules/inventory/admin/dto/inventory.dto.js';

@ApiTags('Inventory')
@Controller('admin/inventory')
export class InventoryController {
  constructor(private readonly service: AdminInventoryService) {}

  @Get(':variantId')
  @Authorize(Permission.CATALOG_PRODUCT_VIEW)
  @ApiOperation({ summary: 'Get variant inventory availability' })
  get(@Param('variantId') variantId: string) {
    return this.service.getAvailability(variantId);
  }

  @Post(':variantId/adjust')
  @Authorize(Permission.CATALOG_PRODUCT_MANAGE)
  @ApiOperation({ summary: 'Adjust variant inventory with an auditable movement' })
  adjust(@Param('variantId') variantId: string, @CurrentUser() user: JwtPayload, @Body() dto: AdjustInventoryDto) {
    return this.service.adjust(variantId, user.sub, dto);
  }

  @Post(':variantId/counts')
  @Authorize(Permission.CATALOG_PRODUCT_MANAGE)
  @ApiOperation({ summary: 'Create a physical stock count snapshot' })
  createCount(
    @Param('variantId') variantId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateStockCountDto,
  ) {
    return this.service.createCount(variantId, user.sub, dto);
  }

  @Post('counts/:countId/confirm')
  @Authorize(Permission.CATALOG_PRODUCT_MANAGE)
  @ApiOperation({ summary: 'Confirm a stock count against current inventory' })
  confirmCount(@Param('countId') countId: string, @CurrentUser() user: JwtPayload) {
    return this.service.confirmCount(countId, user.sub);
  }
}
