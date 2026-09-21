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
import { ApiBearerAuth, ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { ProductsService } from './products.service.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import { ListProductsQueryDto } from './dto/list-products-query.dto.js';
import { CreateVariantDto } from './dto/create-variant.dto.js';
import { UpdateVariantDto } from './dto/update-variant.dto.js';
import { PaginationDto } from './dto/pagination.dto.js';

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STORE_MANAGER', 'MASTER_ADMIN')
  @ApiBearerAuth()
  @ApiCreatedResponse({ description: 'Tạo product thành công' })
  create(@Body() createProductDto: CreateProductDto) {
    return this.productsService.create(createProductDto);
  }

  @Get()
  @ApiOkResponse({ description: 'Danh sách product' })
  findAll(@Query() query: ListProductsQueryDto) {
    return this.productsService.findAll(query);
  }

  @Get(':id')
  @ApiOkResponse({ description: 'Chi tiết 1 product' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.productsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STORE_MANAGER', 'MASTER_ADMIN')
  @ApiBearerAuth()
  @ApiOkResponse({ description: 'Cập nhật product thành công' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() updateProductDto: UpdateProductDto) {
    return this.productsService.update(id, updateProductDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STORE_MANAGER', 'MASTER_ADMIN')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Xoá product thành công' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.productsService.remove(id);
  }

  @Post(':id/variants')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STORE_MANAGER', 'MASTER_ADMIN')
  @ApiBearerAuth()
  @ApiCreatedResponse({ description: 'Tạo variant (kèm inventory) thành công' })
  createVariant(@Param('id', ParseUUIDPipe) productId: string, @Body() createVariantDto: CreateVariantDto) {
    return this.productsService.createVariant(productId, createVariantDto);
  }

  @Get(':id/variants')
  @ApiOkResponse({ description: 'Danh sách variant của 1 product' })
  findAllVariants(@Param('id', ParseUUIDPipe) productId: string, @Query() pagination: PaginationDto) {
    return this.productsService.findAllVariants(productId, pagination);
  }

  @Get(':id/variants/:variantId')
  @ApiOkResponse({ description: 'Chi tiết 1 variant' })
  findOneVariant(@Param('id', ParseUUIDPipe) productId: string, @Param('variantId', ParseUUIDPipe) variantId: string) {
    return this.productsService.findOneVariant(productId, variantId);
  }

  @Patch(':id/variants/:variantId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STORE_MANAGER', 'MASTER_ADMIN')
  @ApiBearerAuth()
  @ApiOkResponse({ description: 'Cập nhật variant thành công' })
  updateVariant(
    @Param('id', ParseUUIDPipe) productId: string,
    @Param('variantId', ParseUUIDPipe) variantId: string,
    @Body() updateVariantDto: UpdateVariantDto,
  ) {
    return this.productsService.updateVariant(productId, variantId, updateVariantDto);
  }

  @Delete(':id/variants/:variantId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STORE_MANAGER', 'MASTER_ADMIN')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Xoá variant thành công' })
  removeVariant(@Param('id', ParseUUIDPipe) productId: string, @Param('variantId', ParseUUIDPipe) variantId: string) {
    return this.productsService.removeVariant(productId, variantId);
  }
}
