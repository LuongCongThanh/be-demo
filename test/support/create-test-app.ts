import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AppModule } from '@src/app.module.js';
import { EmailThrottlerGuard } from '@src/auth/guards/email-throttler.guard.js';
import { configureApp } from '@src/bootstrap/configure-app.js';
import { OBJECT_STORAGE_SERVICE } from '@src/upload-image/object-storage/object-storage.service.js';
import { FakeObjectStorageService } from './fake-object-storage.service.js';

const ALWAYS_ALLOW = { canActivate: () => true };

/**
 * Boots the app for e2e specs that exercise business logic (not rate
 * limiting itself). Both throttler guards are stubbed out — without this,
 * a spec file's own repeated calls to the same route (e.g. several
 * `/auth/login` attempts across different `it()` blocks) would trip the
 * real 429 limits added in 12-rate-limiting.md, for reasons unrelated to
 * what that spec is testing.
 *
 * Rate limiting itself is verified for real, unstubbed, in
 * `auth-rate-limiting.e2e-spec.ts`.
 */
export async function createTestApp(): Promise<{
  app: INestApplication;
  moduleFixture: TestingModule;
  objectStorage: FakeObjectStorageService;
}> {
  const objectStorage = new FakeObjectStorageService();

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
    // Fake in-memory object storage — avoids depending on a real MinIO
    // instance in CI just to exercise business logic (presign/HEAD/copy/
    // cleanup). Real storage is covered by S3ObjectStorageService's own unit
    // tests (policy shape) — see docs/adr/0010.
    .overrideProvider(OBJECT_STORAGE_SERVICE)
    .useValue(objectStorage)
    .compile();

  const app = moduleFixture.createNestApplication();
  configureApp(app);
  await app.init();

  return { app, moduleFixture, objectStorage };
}
