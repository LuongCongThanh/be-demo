import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';

/**
 * Gửi transactional email qua SMTP (nodemailer). Fallback về chỉ log (không
 * gửi thật) khi các biến SMTP_* chưa được set đủ, để local dev và CI vẫn
 * chạy được mà không cần credentials thật — xem .env.example để trỏ tới
 * provider thật (Mailtrap sandbox để test local, hoặc SMTP/SES/SendGrid
 * relay production).
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter | null;
  private readonly from: string;

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>('SMTP_HOST');
    const port = this.config.get<string>('SMTP_PORT');
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');

    this.from = this.config.get<string>('SMTP_FROM', 'no-reply@example.com');

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

  async sendVerificationEmail(to: string, code: string): Promise<void> {
    if (!this.transporter) {
      // Fallback dev/CI: chưa cấu hình SMTP, không thử gửi thật.
      // Không bao giờ log raw code (quy tắc bảo mật, doc/auth-playbook/00-overview.md §5) —
      // đây là verification secret còn dùng được.
      this.logger.log(`[DEV] Would send verification email to ${to}`);
      return;
    }

    await this.transporter.sendMail({
      from: this.from,
      to,
      subject: 'Verify your email address',
      html: `<p>Your email verification code is:</p><p style="font-size:24px;font-weight:bold">${code}</p><p>This code expires in 10 minutes.</p>`,
      text: `Your email verification code is: ${code} (expires in 10 minutes)`,
    });
  }
}
