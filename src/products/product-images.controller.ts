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
import { Roles } from '../auth/decorators/roles.decorator.js';
import { ProductImagesService } from './product-images.service.js';
import { PresignImagesDto } from './dto/presign-images.dto.js';
import { AttachImageDto } from './dto/attach-image.dto.js';
import { PresignedUploadTargetDto } from './dto/presigned-upload-target.dto.js';
import { ImageResponseDto } from './dto/image-response.dto.js';

// Route ảnh tách riêng khỏi ProductsController — module đã có 7 route
// Product+Variant, thêm 5 route ảnh vào cùng file sẽ vượt ngưỡng dễ đọc
// (~300 dòng, docs/convention/coding-style-conventions.md §7).
@ApiTags('Products')
@Controller('products')
export class ProductImagesController {
  constructor(private readonly productImagesService: ProductImagesService) {}

  @Post('images/presign')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STORE_MANAGER', 'MASTER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Request presigned POST upload targets for up to 10 images (STORE_MANAGER/MASTER_ADMIN only)',
  })
  @ApiCreatedResponse({ type: [PresignedUploadTargetDto] })
  presign(@Body() dto: PresignImagesDto) {
    return this.productImagesService.presign(dto);
  }

  @Post(':id/images')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STORE_MANAGER', 'MASTER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Attach an already-uploaded image to a product (STORE_MANAGER/MASTER_ADMIN only)',
  })
  @ApiCreatedResponse({ type: ImageResponseDto })
  attachImage(@Param('id', ParseUUIDPipe) productId: string, @Body() dto: AttachImageDto) {
    return this.productImagesService.attachImage(productId, dto);
  }

  @Get(':id/images')
  @ApiOperation({ summary: "List a product's images (unpaginated, public)" })
  @ApiOkResponse({ type: [ImageResponseDto] })
  listImages(@Param('id', ParseUUIDPipe) productId: string) {
    return this.productImagesService.listImages(productId);
  }

  @Patch(':id/images/:imageId/primary')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STORE_MANAGER', 'MASTER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Set an image as the product primary image (STORE_MANAGER/MASTER_ADMIN only)' })
  @ApiOkResponse({ type: ImageResponseDto })
  setPrimary(@Param('id', ParseUUIDPipe) productId: string, @Param('imageId', ParseUUIDPipe) imageId: string) {
    return this.productImagesService.setPrimary(productId, imageId);
  }

  @Delete(':id/images/:imageId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STORE_MANAGER', 'MASTER_ADMIN')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary:
      'Delete a product image (DB row removed immediately, storage cleanup best-effort) (STORE_MANAGER/MASTER_ADMIN only)',
  })
  @ApiNoContentResponse({ description: 'Image deleted' })
  removeImage(@Param('id', ParseUUIDPipe) productId: string, @Param('imageId', ParseUUIDPipe) imageId: string) {
    return this.productImagesService.removeImage(productId, imageId);
  }
}
