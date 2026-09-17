import { ExecutionContext, HttpException } from '@nestjs/common';
import { EmailThrottlerGuard } from './email-throttler.guard.js';

function createContext(options: { route?: string; body?: Record<string, unknown>; ip?: string }): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        route: { path: options.route ?? '/auth/forgot-password' },
        body: options.body ?? {},
        ip: options.ip ?? '127.0.0.1',
      }),
    }),
  } as unknown as ExecutionContext;
}

describe('EmailThrottlerGuard', () => {
  it('allows the first request for a given email on a given route', () => {
    const guard = new EmailThrottlerGuard();

    expect(guard.canActivate(createContext({ body: { email: 'user@example.com' } }))).toBe(true);
  });

  it('throws 429 on the second request for the same email within the TTL window', () => {
    const guard = new EmailThrottlerGuard();
    const context = createContext({ body: { email: 'user@example.com' } });

    guard.canActivate(context);

    expect(() => guard.canActivate(context)).toThrow(HttpException);
    try {
      guard.canActivate(context);
    } catch (err) {
      expect((err as HttpException).getStatus()).toBe(429);
    }
  });

  it('does not count a different email against the same bucket', () => {
    const guard = new EmailThrottlerGuard();
    guard.canActivate(createContext({ body: { email: 'first@example.com' } }));

    expect(guard.canActivate(createContext({ body: { email: 'second@example.com' } }))).toBe(true);
  });

  it('tracks routes independently: the same email on a different route is not blocked', () => {
    const guard = new EmailThrottlerGuard();
    guard.canActivate(createContext({ route: '/auth/forgot-password', body: { email: 'user@example.com' } }));

    expect(
      guard.canActivate(createContext({ route: '/auth/resend-verification', body: { email: 'user@example.com' } })),
    ).toBe(true);
  });

  it('falls back to IP as the key when the request body has no email', () => {
    const guard = new EmailThrottlerGuard();
    guard.canActivate(createContext({ ip: '1.2.3.4', body: {} }));

    expect(() => guard.canActivate(createContext({ ip: '1.2.3.4', body: {} }))).toThrow(HttpException);
  });
});
