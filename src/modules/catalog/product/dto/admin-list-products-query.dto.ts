import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { ProductStatus } from '#src/generated/prisma/enums.js';
import { ListProductsQueryDto } from '#src/modules/catalog/product/dto/list-products-query.dto.js';

export class AdminListProductsQueryDto extends ListProductsQueryDto {
  @ApiPropertyOptional({ enum: ProductStatus, enumName: 'ProductStatus', example: ProductStatus.DRAFT })
  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;
}
