import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { VerifyEmailDto } from '../dto/verify-email.dto.js';
import { MessageResponseDto } from '../dto/message-response.dto.js';
import { PasswordService } from './password.service.js';
import { TokenService } from './token.service.js';
import { MailService } from '../../mail/mail.service.js';
import { RegisterDto } from '../dto/register.dto.js';
import { RegisterResponseDto } from '../dto/register-response.dto.js';

// Code 6 chữ số chỉ có 1.000.000 khả năng, khác với raw token 32-byte cũ,
// nên có thể bị brute-force trong thời gian hết hạn nếu không giới hạn số
// lần đoán sai.
const MAX_VERIFY_ATTEMPTS = 5;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
    private readonly mailService: MailService,
  ) {}

  async register(dto: RegisterDto): Promise<RegisterResponseDto> {
    // Kiểm tra email trùng tường minh (thay vì dựa vào DB unique constraint
    // throw lỗi) để trả 409 rõ ràng trước khi tốn công hash/ghi DB, và đúng
    // theo decision #10: register cần lỗi "email đã tồn tại" rõ ràng, khác
    // với forgot-password hay resend-verification (cố tình giấu việc email
    // có tồn tại hay không).
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email is already in use');
    }

    // Hash password tốn CPU và không đụng tới DB, nên làm trước (và ngoài)
    // transaction, tránh giữ transaction DB mở trong lúc argon2 chạy.
    const passwordHash = await this.passwordService.hash(dto.password);

    let user: { id: string; email: string };
    let rawCode: string;
    try {
      ({ user, rawCode } = await this.prisma.$transaction(async (tx) => {
        const customerRole = await tx.role.findUniqueOrThrow({
          where: { name: 'CUSTOMER' },
        });

        const createdUser = await tx.user.create({
          data: {
            email: dto.email,
            passwordHash,
            fullName: dto.fullName,
            phone: dto.phone,
            status: 'ACTIVE',
            userRoles: { create: [{ roleId: customerRole.id }] },
          },
        });

        const code = await this.tokenService.createEmailVerificationToken(createdUser.id, tx);

        return { user: createdUser, rawCode: code };
      }));
    } catch (err) {
      // Check findUnique ở trên chỉ chặn được phần lớn trường hợp trùng
      // email; 2 request đồng thời cùng email đều có thể pass check đó, nên
      // unique constraint của DB mới là chốt chặn thật sự. Chuyển race đó
      // thành cùng lỗi 409 như pre-check — nhưng chỉ khi constraint bị vi
      // phạm đúng là `email`. Transaction này cũng tạo EmailVerificationToken
      // với `tokenHash` unique riêng, nên chỉ check `code === 'P2002'` sẽ
      // báo nhầm một collision tokenHash (cực hiếm) thành "email đã tồn tại".
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002' &&
        (err.meta?.target as string[] | undefined)?.includes('email')
      ) {
        throw new ConflictException('Email is already in use');
      }
      throw err;
    }

    // Gửi email là external call, phải chạy SAU khi transaction đã commit —
    // không bao giờ đặt trong transaction (SMTP chậm/treo sẽ giữ lock DB).
    // Lỗi ở đây chỉ log lại, không rollback hay fail request: user đã tạo
    // thành công và có thể dùng "resend verification" để nhận code mới.
    try {
      await this.mailService.sendVerificationEmail(user.email, rawCode);
    } catch (err) {
      this.logger.error(`Failed to send verification email to ${user.email}`, err as Error);
    }

    return { id: user.id, email: user.email };
  }

  async verifyEmail(dto: VerifyEmailDto): Promise<MessageResponseDto> {
    // Code 6 chữ số (chỉ 1.000.000 khả năng) không đủ unique để tự nó định
    // danh 1 record an toàn — khác với raw token 32-byte cũ — nên tìm code
    // đang chờ của user theo userId trước (chỉ có tối đa 1, vì
    // createEmailVerificationToken() đã xóa mọi token chưa verify trước đó),
    // rồi so hash tại đây. Cách này cũng cho phép đếm cả lượt đoán sai vào
    // `attempts`, điều mà lookup theo tokenHash không làm được (code sai thì
    // đơn giản là không match row nào).
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    const record = user
      ? await this.prisma.emailVerificationToken.findFirst({
          where: { userId: user.id },
          orderBy: { createdAt: 'desc' },
        })
      : null;

    if (!record) {
      // Cùng 1 lỗi cho cả 2 trường hợp email không tồn tại hoặc không có
      // code đang chờ — không lộ ra là trường hợp nào.
      throw new NotFoundException('Invalid email or code');
    }
    if (record.verifiedAt) {
      // Chống replay: code đã dùng rồi, gọi lại lần 2 phải bị reject
      // (không phải hành vi idempotent).
      throw new BadRequestException('Code already used');
    }
    if (record.expiresAt < new Date()) {
      throw new BadRequestException('Code has expired');
    }
    if (record.attempts >= MAX_VERIFY_ATTEMPTS) {
      throw new BadRequestException('Too many attempts. Request a new code.');
    }

    if (this.tokenService.hashRawToken(dto.code) !== record.tokenHash) {
      // Vẫn tính lượt đoán sai này dù code không hợp lệ — đây chính là cách
      // giới hạn brute-force code 6 chữ số trong thời gian hết hạn. Dùng
      // updateMany với điều kiện `attempts: { lt: MAX_VERIFY_ATTEMPTS }`
      // thay vì update thường, để tránh race: nhiều request đoán sai đến
      // cùng lúc khi attempts đang ở ngưỡng gần giới hạn có thể đều đọc thấy
      // "chưa vượt giới hạn" và đều tăng, khiến attempts vượt quá
      // MAX_VERIFY_ATTEMPTS. Điều kiện trong WHERE để DB tự xử lý atomic.
      await this.prisma.emailVerificationToken.updateMany({
        where: { id: record.id, attempts: { lt: MAX_VERIFY_ATTEMPTS } },
        data: { attempts: { increment: 1 } },
      });
      throw new NotFoundException('Invalid email or code');
    }

    // Read findFirst() ở trên không atomic với update bên dưới, nên 2 request
    // đồng thời cho cùng 1 token đều có thể pass check record.verifiedAt
    // trước khi cái nào commit. Chống race này bằng cách "claim" token qua
    // conditional update (`verifiedAt: null` trong WHERE) trong transaction:
    // DB tự đảm bảo chỉ 1 caller thắng. Nếu thua race, không cần undo gì
    // thêm, reject giống như token đã dùng rồi.
    const wonRace = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.emailVerificationToken.updateMany({
        where: { id: record.id, verifiedAt: null },
        data: { verifiedAt: new Date() },
      });
      if (claimed.count === 0) {
        return false;
      }

      await tx.user.update({
        where: { id: record.userId },
        data: { emailVerifiedAt: new Date() },
      });
      return true;
    });

    if (!wonRace) {
      throw new BadRequestException('Code already used');
    }

    return { message: 'Email verified successfully' };
  }
}
