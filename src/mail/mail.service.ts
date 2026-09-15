import { Injectable, Logger } from '@nestjs/common';

/**
 * Sends transactional emails. For now this only logs — swap the method
 * bodies for real SMTP/SES/SendGrid calls when a provider is wired up; the
 * signature (and every caller) stays the same.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  async sendVerificationEmail(to: string, _rawToken: string): Promise<void> {
    // Never log the raw token (security rule, doc/auth-playbook/00-overview.md §6) —
    // it's a live, usable verification secret. Logging that it was sent is enough.
    this.logger.log(`[DEV] Sending verification email to ${to}`);
  }
}
