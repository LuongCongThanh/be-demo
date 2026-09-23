import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { JwtPayload } from '../auth/strategies/jwt.strategy.js';
import { UploadImageService } from './upload-image.service.js';
import { PresignUploadImagesDto } from './dto/presign-upload-images.dto.js';
import { PresignedUploadTargetDto } from './dto/presigned-upload-target.dto.js';

@ApiTags('Upload Images')
@Controller('upload-images')
export class UploadImageController {
  constructor(private readonly uploadImageService: UploadImageService) {}

  @Post('presign')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Request presigned POST upload targets for up to 10 images; allowed roles depend on purpose (PRODUCT_IMAGE: STORE_MANAGER/MASTER_ADMIN)',
  })
  @ApiCreatedResponse({ type: [PresignedUploadTargetDto] })
  presign(@CurrentUser() user: JwtPayload, @Body() dto: PresignUploadImagesDto) {
    return this.uploadImageService.presign(user, dto);
  }
}
