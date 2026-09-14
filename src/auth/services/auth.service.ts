import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { PasswordService } from './password.service.js';
import { TokenService } from './token.service.js';
import { MailService } from '../../mail/mail.service.js';
import { RegisterDto } from '../dto/register.dto.js';
import { RegisterResponseDto } from '../dto/register-response.dto.js';

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

    const { user, rawToken } = await this.prisma.$transaction(async (tx) => {
      const customerRole = await tx.role.findUniqueOrThrow({
        where: { name: 'CUSTOMER' },
      });

      const createdUser = await tx.user.create({
        data: {
          email: dto.email,
          passwordHash,
          status: 'ACTIVE',
          userRoles: { create: [{ roleId: customerRole.id }] },
        },
      });

      const rawTok = await this.tokenService.createEmailVerificationToken(
        createdUser.id,
        tx,
      );

      return { user: createdUser, rawToken: rawTok };
    });

    // Sending email is an external call and must happen AFTER the
    // transaction has committed — never inside it (a slow/hanging SMTP call
    // would otherwise hold DB locks open). A failure here is logged but
    // does not roll back or fail the request: the user was created
    // successfully and can use "resend verification" to get a new email.
    try {
      await this.mailService.sendVerificationEmail(user.email, rawToken);
    } catch (err) {
      this.logger.error(
        `Failed to send verification email to ${user.email}`,
        err as Error,
      );
    }

    return { id: user.id, email: user.email };
  }
}
