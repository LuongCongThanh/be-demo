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

// 6-digit codes only have 1,000,000 possibilities, so unlike the old 32-byte
// raw token, they're brute-forceable within the expiry window unless wrong
// guesses are capped.
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
    // Email uniqueness is checked explicitly (rather than relying on the DB
    // unique constraint throwing) so we can return a clear 409 before doing
    // any hashing/DB-write work, and to match decision #10: register wants
    // an unambiguous "email already in use" error, unlike forgot-password
    // or resend-verification, which deliberately hide whether an email
    // exists.
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email is already in use');
    }

    // Hashing is CPU-heavy and doesn't touch the DB, so it happens before
    // (and outside) the transaction rather than holding a DB transaction
    // open while argon2 runs.
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
      // The findUnique check above only catches most duplicate-email
      // registrations; two concurrent requests for the same email can both
      // pass that check, so the DB's unique constraint is the real guard.
      // Translate that race into the same 409 the pre-check produces — but
      // only when the violated constraint is actually `email`. The same
      // transaction also creates an EmailVerificationToken with its own
      // unique `tokenHash`, so a bare `code === 'P2002'` check would
      // misreport a (vanishingly unlikely) tokenHash collision as "email
      // already in use".
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002' &&
        (err.meta?.target as string[] | undefined)?.includes('email')
      ) {
        throw new ConflictException('Email is already in use');
      }
      throw err;
    }

    // Sending email is an external call and must happen AFTER the
    // transaction has committed — never inside it (a slow/hanging SMTP call
    // would otherwise hold DB locks open). A failure here is logged but
    // does not roll back or fail the request: the user was created
    // successfully and can use "resend verification" to get a new email.
    try {
      await this.mailService.sendVerificationEmail(user.email, rawCode);
    } catch (err) {
      this.logger.error(`Failed to send verification email to ${user.email}`, err as Error);
    }

    return { id: user.id, email: user.email };
  }

  async verifyEmail(dto: VerifyEmailDto): Promise<MessageResponseDto> {
    // The code alone (6 digits, only 1,000,000 possibilities) isn't unique
    // enough to safely identify a record on its own — unlike the old
    // 32-byte raw token — so look up the user's own pending code by userId
    // first (there's at most one, since createEmailVerificationToken()
    // deletes any prior unverified one), then compare hashes locally. This
    // also lets a wrong guess still be counted against `attempts`, which a
    // tokenHash-based lookup couldn't do (a wrong code just matches no row).
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    const record = user
      ? await this.prisma.emailVerificationToken.findFirst({
          where: { userId: user.id },
          orderBy: { createdAt: 'desc' },
        })
      : null;

    if (!record) {
      // Same error whether the email doesn't exist or has no pending code —
      // don't leak which one it was.
      throw new NotFoundException('Invalid email or code');
    }
    if (record.verifiedAt) {
      // Replay protection: code đã dùng rồi, gọi lại lần 2 phải bị reject
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
      // Count the wrong guess even though the code is invalid — this is
      // what bounds brute-forcing a 6-digit code within its expiry window.
      await this.prisma.emailVerificationToken.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      });
      throw new NotFoundException('Invalid email or code');
    }

    // The findFirst() read above is not atomic with the update below, so
    // two concurrent requests for the same token could both pass the
    // record.verifiedAt check before either commits. Guard against that
    // race by claiming the token with a conditional update (`verifiedAt:
    // null` in the WHERE clause) inside the transaction: the DB itself
    // enforces that only one caller can win. If we lose the race, undo
    // nothing else and reject the same way an already-used token would.
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
