import { randomInt, createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

const EMAIL_VERIFICATION_TTL_MS = 10 * 60 * 1000; // 10 phút — ngắn vì là code 6 chữ số dễ đoán

/**
 * Subset của Prisma client mà service này cần — khớp cả với `PrismaService`
 * lẫn object `tx` mà Prisma truyền vào callback `$transaction(async (tx) =>
 * ...)`, để caller có thể truyền `tx` nhằm giữ việc tạo token trong
 * transaction đang chạy thay vì mở thêm 1 transaction mới.
 */
type EmailVerificationTokenClient = Pick<PrismaService, 'emailVerificationToken'>;

/**
 * Sinh và hash các one-time token (hiện tại: email verification, gửi cho
 * user dưới dạng code 6 chữ số).
 *
 * Raw code chỉ được trả về cho caller (để gửi email cho user) — DB luôn lưu
 * hash SHA-256 của nó, không bao giờ lưu giá trị gốc, giống cách password
 * không bao giờ lưu raw.
 */
@Injectable()
export class TokenService {
  constructor(private readonly prisma: PrismaService) {}

  private generate(): { rawCode: string; tokenHash: string } {
    const rawCode = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const tokenHash = this.hashRawToken(rawCode);
    return { rawCode, tokenHash };
  }

  hashRawToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  /**
   * Tạo email verification token mới cho user, xóa trước mọi token chưa
   * verify đang có (để đăng ký lại / resend không bao giờ để dư hơn 1 token
   * hợp lệ).
   *
   * Truyền `client` (ví dụ `tx` từ 1 `prisma.$transaction` đang chạy) để cả
   * 2 lệnh ghi chạy trong transaction đó thay vì mở transaction mới. Khi
   * không truyền `client`, cặp delete+create được bọc trong transaction
   * riêng để nếu lỗi giữa 2 lệnh thì user không bao giờ bị mất trắng token
   * hợp lệ.
   */
  async createEmailVerificationToken(
    userId: string,
    client: EmailVerificationTokenClient = this.prisma,
  ): Promise<string> {
    const { rawCode, tokenHash } = this.generate();
    const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS);

    const write = async (c: EmailVerificationTokenClient) => {
      await c.emailVerificationToken.deleteMany({
        where: { userId, verifiedAt: null },
      });
      await c.emailVerificationToken.create({
        data: { userId, tokenHash, expiresAt },
      });
    };

    if (client === this.prisma) {
      await this.prisma.$transaction((tx) => write(tx));
    } else {
      await write(client);
    }

    return rawCode;
  }
}
