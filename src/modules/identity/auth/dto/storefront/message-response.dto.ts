import { ApiProperty } from '@nestjs/swagger';

// Response dùng chung: nhiều endpoint (verify-email, logout, ...) chỉ cần
// trả về { message: "..." }, nên viết 1 class này để dùng lại thay vì
// mỗi endpoint tự tạo 1 class giống hệt nhau.
export class MessageResponseDto {
  @ApiProperty() // để Swagger UI hiển thị field này trong doc API
  message: string;
}
