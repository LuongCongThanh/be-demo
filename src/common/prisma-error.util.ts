import { ConflictException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';

// Prisma không type hoá `meta` theo error code — `target` chỉ tồn tại (và chỉ
// là string[]) cho P2002. Tách helper này để cả AllExceptionsFilter và mọi
// service cần đọc field bị vi phạm unique constraint đều cast đúng 1 chỗ,
// tránh 2 nơi tự cast rồi lệch nhau.
export function getUniqueConstraintTarget(exception: Prisma.PrismaClientKnownRequestError): string[] | undefined {
  return exception.meta?.target as string[] | undefined;
}

// Pre-check unique ở mỗi caller (findUnique trước khi create/update) chỉ
// chặn được phần lớn trường hợp trùng — 2 request gần như đồng thời vẫn có
// thể cùng pass pre-check (race window), nên unique constraint của DB mới là
// chốt chặn thật sự. Helper này chạy write thật, và nếu DB từ chối đúng bằng
// P2002 trên field kỳ vọng, dịch nó thành 1 lỗi 409 thân thiện — thay vì để
// rơi xuống message thô của Prisma qua AllExceptionsFilter. Dùng chung cho
// mọi module (đóng cùng 1 loại race theo cùng 1 cách, không để mỗi module tự
// implement lại).
export async function writeUnique<T>(
  write: () => Promise<T>,
  uniqueField: string,
  conflictMessage: string,
): Promise<T> {
  try {
    return await write();
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002' &&
      getUniqueConstraintTarget(err)?.includes(uniqueField)
    ) {
      throw new ConflictException(conflictMessage);
    }
    throw err;
  }
}
