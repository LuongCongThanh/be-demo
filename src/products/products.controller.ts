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
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { CATALOG_STAFF_ROLES, Roles } from '../auth/decorators/roles.decorator.js';
import { StaffQueryFlagGuard } from '../auth/guards/staff-query-flag.guard.js';
import { VariantVisibilityQueryDto } from './dto/variant-visibility-query.dto.js';
import { ProductsService } from './products.service.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import { ListProductsQueryDto } from './dto/list-products-query.dto.js';
import { ProductResponseDto } from './dto/product-response.dto.js';
import { PaginatedProductResponseDto } from './dto/paginated-product-response.dto.js';

@ApiTags('Products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...CATALOG_STAFF_ROLES)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create a product with its variants and images in one call (STORE_MANAGER/MASTER_ADMIN only)',
  })
  @ApiCreatedResponse({ type: ProductResponseDto })
  create(@Body() createProductDto: CreateProductDto) {
    return this.productsService.create(createProductDto);
  }

  @Get()
  @UseGuards(StaffQueryFlagGuard('includeAllVariants'))
  @ApiOperation({
    summary:
      'List products (paginated, filterable by category/status, public — only ACTIVE variants unless includeAllVariants=true for STORE_MANAGER/MASTER_ADMIN)',
  })
  @ApiOkResponse({ type: PaginatedProductResponseDto })
  findAll(@Query() query: ListProductsQueryDto) {
    return this.productsService.findAll(query);
  }

  @Get(':id')
  @UseGuards(StaffQueryFlagGuard('includeAllVariants'))
  @ApiOperation({
    summary:
      'Get a product by id (public — only ACTIVE variants unless includeAllVariants=true for STORE_MANAGER/MASTER_ADMIN)',
  })
  @ApiOkResponse({ type: ProductResponseDto })
  findOne(@Param('id', ParseUUIDPipe) id: string, @Query() { includeAllVariants }: VariantVisibilityQueryDto) {
    return this.productsService.findOne(id, includeAllVariants);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...CATALOG_STAFF_ROLES)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Update a product; variants[]/images[] are full desired state, all changes apply in one transaction (STORE_MANAGER/MASTER_ADMIN only)',
  })
  @ApiOkResponse({ type: ProductResponseDto })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() updateProductDto: UpdateProductDto) {
    return this.productsService.update(id, updateProductDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...CATALOG_STAFF_ROLES)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a product, cascading to its variants and inventory (STORE_MANAGER/MASTER_ADMIN only)',
  })
  @ApiNoContentResponse({ description: 'Product deleted' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.productsService.remove(id);
  }
}
