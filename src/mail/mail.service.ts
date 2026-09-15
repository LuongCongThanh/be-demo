import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';

/**
 * Sends transactional emails over SMTP (nodemailer). Falls back to logging
 * only (no real send) when SMTP_* env vars aren't fully set, so local dev
 * and CI keep working without real credentials — see .env.example for how
 * to point this at a real provider (Mailtrap sandbox for local testing, or
 * your production SMTP/SES/SendGrid relay).
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter | null;
  private readonly from: string;
  private readonly frontendUrl: string;

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>('SMTP_HOST');
    const port = this.config.get<string>('SMTP_PORT');
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');

    this.from = this.config.get<string>('SMTP_FROM', 'no-reply@example.com');
    this.frontendUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:3000');

    this.transporter =
      host && port && user && pass
        ? nodemailer.createTransport({
            host,
            port: Number(port),
            secure: Number(port) === 465, // 465 = implicit TLS; 587/25 use STARTTLS
            auth: { user, pass },
          })
        : null;

    if (!this.transporter) {
      this.logger.warn(
        'SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS not fully set — emails will only be logged, not actually sent. See .env.example.',
      );
    }
  }

  async sendVerificationEmail(to: string, rawToken: string): Promise<void> {
    const link = `${this.frontendUrl}/verify-email?token=${encodeURIComponent(rawToken)}`;

    if (!this.transporter) {
      // Dev/CI fallback: no SMTP configured, don't attempt a real send.
      // Never log the raw token itself (security rule, doc/auth-playbook/00-overview.md §5) —
      // it's a live, usable verification secret.
      this.logger.log(`[DEV] Would send verification email to ${to}`);
      return;
    }

    await this.transporter.sendMail({
      from: this.from,
      to,
      subject: 'Verify your email address',
      html: `<p>Click the link below to verify your email address:</p><p><a href="${link}">${link}</a></p>`,
      text: `Verify your email address: ${link}`,
    });
  }
}
