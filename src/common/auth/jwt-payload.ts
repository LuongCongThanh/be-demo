import type { Role } from '#src/generated/prisma/enums.js';

/** Payload JWT đã được JwtStrategy (modules/identity) xác thực, gắn vào request.user. */
export interface JwtPayload {
  sub: string; // userId
  email: string;
  role: Role; // đúng 1 vai trò mỗi Tài khoản (ADR 0005)
  sessionVersion: number; // phải khớp users.session_version hiện tại — Mục 13
}
