import { Module } from '@nestjs/common';
import { MailSender } from '#src/infrastructure/mail/mail.port.js';
import { MailService } from '#src/infrastructure/mail/mail.service.js';

@Module({
  providers: [MailService, { provide: MailSender, useExisting: MailService }],
  exports: [MailService, MailSender],
})
export class MailModule {}
