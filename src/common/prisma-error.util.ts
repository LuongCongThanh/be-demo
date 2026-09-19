import { Prisma } from '../generated/prisma/client.js';

// Prisma không type hoá `meta` theo error code — `target` chỉ tồn tại (và chỉ
// là string[]) cho P2002. Tách helper này để cả AllExceptionsFilter và mọi
// service cần đọc field bị vi phạm unique constraint đều cast đúng 1 chỗ,
// tránh 2 nơi tự cast rồi lệch nhau.
export function getUniqueConstraintTarget(exception: Prisma.PrismaClientKnownRequestError): string[] | undefined {
  return exception.meta?.target as string[] | undefined;
}
