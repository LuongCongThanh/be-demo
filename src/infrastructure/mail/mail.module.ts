import { Module } from '@nestjs/common';
import { MailService } from '#src/infrastructure/mail/mail.service.js';

@Module({
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
