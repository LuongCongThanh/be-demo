import { Injectable, Logger } from '@nestjs/common';

/**
 * Sends transactional emails. For now this only logs — swap the method
 * bodies for real SMTP/SES/SendGrid calls when a provider is wired up; the
 * signature (and every caller) stays the same.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  async sendVerificationEmail(to: string, rawToken: string): Promise<void> {
    this.logger.log(
      `[DEV] Sending verification email to ${to}: token=${rawToken}`,
    );
  }
}
