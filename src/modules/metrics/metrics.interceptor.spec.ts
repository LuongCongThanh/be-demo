import { CallHandler, ExecutionContext } from '@nestjs/common';
import { of } from 'rxjs';
import { MetricsInterceptor } from './metrics.interceptor.js';
import { MetricsService } from './metrics.service.js';

function createContext(request: object) {
  const listeners: Record<string, () => void> = {};
  const response = {
    statusCode: 200,
    on: (event: string, cb: () => void) => {
      listeners[event] = cb;
    },
  };
  const context = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ExecutionContext;
  const next: CallHandler = { handle: () => of('handled') };

  return { context, next, response, fireFinish: () => listeners.finish() };
}

describe('MetricsInterceptor', () => {
  it('labels the route using request.route.path when the route matched', () => {
    const metrics = { recordRequest: vi.fn() } as unknown as MetricsService;
    const interceptor = new MetricsInterceptor(metrics);
    const { context, next, fireFinish } = createContext({
      method: 'GET',
      route: { path: '/api/v1/health/live' },
      url: '/api/v1/health/live',
    });

    interceptor.intercept(context, next).subscribe();
    fireFinish();

    expect(metrics.recordRequest).toHaveBeenCalledWith(
      { method: 'GET', route: '/api/v1/health/live', status_code: '200' },
      expect.any(Number),
    );
  });

  it('falls back to request.url for unmatched routes (e.g. 404s), where request.route is undefined', () => {
    const metrics = { recordRequest: vi.fn() } as unknown as MetricsService;
    const interceptor = new MetricsInterceptor(metrics);
    const { context, next, response, fireFinish } = createContext({
      method: 'GET',
      url: '/no-such-route',
    });
    response.statusCode = 404;

    interceptor.intercept(context, next).subscribe();
    fireFinish();

    expect(metrics.recordRequest).toHaveBeenCalledWith(
      { method: 'GET', route: '/no-such-route', status_code: '404' },
      expect.any(Number),
    );
  });
});
