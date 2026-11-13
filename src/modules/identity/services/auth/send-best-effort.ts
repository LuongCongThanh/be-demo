import type { Logger } from '@nestjs/common';

// Dùng chung cho mọi lần gửi mail "best effort": lỗi chỉ log lại, không
// throw — caller (register/resendVerification/forgotPassword) đã hoàn tất
// phần việc chính của mình (tạo user / tạo token mới), gửi mail thất bại
// không nên làm fail cả request đó.
export async function sendBestEffort(logger: Logger, send: () => Promise<void>, errorMessage: string): Promise<void> {
  try {
    await send();
  } catch (err) {
    logger.error(errorMessage, err as Error);
  }
}
