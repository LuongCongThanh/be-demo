import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../src/app.module.js';
import { MailService } from '../src/mail/mail.service.js';

// Real SMTP send against Mailtrap sandbox — hits the network and depends on
// SMTP_* being set in .env (see .env.example), so it's opt-in only and never
// runs as part of the normal `test:e2e` / CI run.
// Enable locally with: RUN_REAL_SMTP_TESTS=1 npm run test:e2e -- mail-smtp
const runRealSmtpTests = process.env.RUN_REAL_SMTP_TESTS === '1';

describe.skipIf(!runRealSmtpTests)('MailService — real SMTP send (e2e, opt-in)', () => {
  let mailService: MailService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    mailService = moduleFixture.get(MailService);
  });

  it('sends the verification email through the configured SMTP transport without throwing', async () => {
    const to = `mail-smtp.e2e-test.${Date.now()}@example.com`;

    await expect(mailService.sendVerificationEmail(to, '123456')).resolves.toBeUndefined();
  });
});
