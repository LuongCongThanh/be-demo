import { randomBytes, createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000; // 24h

/**
 * Subset of the Prisma client this service needs — matches both
 * `PrismaService` and the `tx` object Prisma hands to `$transaction(async
 * (tx) => ...)` callbacks, so callers can pass `tx` to keep token creation
 * inside an existing transaction instead of opening a second one.
 */
type EmailVerificationTokenClient = Pick<
  PrismaService,
  'emailVerificationToken'
>;

/**
 * Generates and hashes one-time tokens (currently: email verification).
 *
 * The raw token is only ever returned to the caller (to be emailed to the
 * user) — the database always stores a SHA-256 hash of it, never the raw
 * value, the same way passwords are never stored raw.
 */
@Injectable()
export class TokenService {
  constructor(private readonly prisma: PrismaService) {}

  private generate(): { rawToken: string; tokenHash: string } {
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = this.hashRawToken(rawToken);
    return { rawToken, tokenHash };
  }

  hashRawToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  /**
   * Creates a new email verification token for the user, first deleting any
   * unverified token already on file (so re-registering / resending never
   * leaves more than one valid token around).
   *
   * Pass `client` (e.g. the `tx` from an in-progress `prisma.$transaction`)
   * to run both writes inside that transaction instead of opening a new one.
   * When no `client` is passed, the delete+create pair is wrapped in its own
   * transaction so a failure between the two never leaves the user with zero
   * valid tokens.
   */
  async createEmailVerificationToken(
    userId: string,
    client: EmailVerificationTokenClient = this.prisma,
  ): Promise<string> {
    const { rawToken, tokenHash } = this.generate();
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

    return rawToken;
  }
}
