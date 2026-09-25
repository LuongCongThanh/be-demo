import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min, ValidateIf } from 'class-validator';

// Không có `code`/`type`: cả hai là một phần của SKU đã phát hành
// (docs/adr/0011) — forbidNonWhitelisted trả 400 nếu client gửi lên.
export class UpdateOptionValueDto {
  @ApiPropertyOptional({ maxLength: 50, example: 'Đen tuyền' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @ValidateIf((_, value) => value !== undefined)
  @IsNotEmpty()
  @IsString()
  @MaxLength(50)
  name?: string;

  @ApiPropertyOptional({ minimum: 0, example: 3 })
  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;

  @ApiPropertyOptional({
    description: 'Ẩn khỏi danh sách chọn — dùng thay cho xoá khi đang có variant dùng',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  hidden?: boolean;
}
