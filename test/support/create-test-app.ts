import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AppModule } from '#src/app.module.js';
import { EmailThrottlerGuard } from '#src/modules/identity/auth/email-throttler.guard.js';
import { configureApp } from '#src/bootstrap/configure-app.js';
import { CloudinaryClient } from '#src/infrastructure/storage/cloudinary.client.js';

const ALWAYS_ALLOW = { canActivate: () => true };

/** E2e không gọi kho ảnh thật: mọi key coi như đã upload một JPEG 1 KB. */
const FAKE_STORAGE: Partial<CloudinaryClient> = {
  publicUrl: () => null,
  signUpload: () => ({ uploadUrl: 'https://storage.test/upload', fields: {}, expiresAt: new Date() }),
  findImage: () => Promise.resolve({ bytes: 1024, format: 'jpg' }),
  destroy: () => Promise.resolve(),
};

/**
 * Boots the app for e2e specs that exercise business logic (not rate
 * limiting itself). Both throttler guards are stubbed out — without this,
 * a spec file's own repeated calls to the same route (e.g. several
 * `/auth/login` attempts across different `it()` blocks) would trip the
 * real 429 limits added in 12-rate-limiting.md, for reasons unrelated to
 * what that spec is testing.
 *
 * Rate limiting itself is verified for real, unstubbed, in
 * `auth-rate-limiting.e2e-spec.ts`. The image storage adapter is stubbed too,
 * so specs never call Cloudinary.
 */
export async function createTestApp(): Promise<{ app: INestApplication; moduleFixture: TestingModule }> {
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  })
    // `overrideGuard()`/`overrideProvider(APP_GUARD)` would only ADD a stub
    // alongside the real global guard, not replace it — APP_GUARD is a
    // `multi: true` token (see src/app.module.ts). Overriding the
    // `ThrottlerGuard` class provider directly is what actually disables it.
    .overrideProvider(ThrottlerGuard)
    .useValue(ALWAYS_ALLOW)
    .overrideGuard(EmailThrottlerGuard)
    .useValue(ALWAYS_ALLOW)
    .overrideProvider(CloudinaryClient)
    .useValue(FAKE_STORAGE)
    .compile();

  const app = moduleFixture.createNestApplication();
  configureApp(app);
  await app.init();

  return { app, moduleFixture };
}
