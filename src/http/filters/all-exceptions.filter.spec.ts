import { HttpException, HttpStatus } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import {
  BusinessError,
  ConflictError,
  ForbiddenError,
  InvalidInputError,
  NotFoundError,
  UnauthenticatedError,
  UnprocessableError,
} from '#src/common/errors/business-errors.js';
import { AllExceptionsFilter } from '#src/http/filters/all-exceptions.filter.js';
import { RequestContext } from '#src/infrastructure/observability/logging/request-context.js';

function run(exception: unknown) {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  const host = { switchToHttp: () => ({ getResponse: () => ({ status }) }) };
  RequestContext.run('req-1', () => new AllExceptionsFilter().catch(exception, host as never));
  return { status: status.mock.calls[0][0], body: json.mock.calls[0][0] };
}

describe('AllExceptionsFilter business errors', () => {
  it.each([
    [NotFoundError, HttpStatus.NOT_FOUND],
    [ConflictError, HttpStatus.CONFLICT],
    [InvalidInputError, HttpStatus.BAD_REQUEST],
    [UnprocessableError, HttpStatus.UNPROCESSABLE_ENTITY],
    [UnauthenticatedError, HttpStatus.UNAUTHORIZED],
    [ForbiddenError, HttpStatus.FORBIDDEN],
  ] as [new (message: string) => BusinessError, number][])('%o maps to %i keeping message and shape', (Err, code) => {
    const { status, body } = run(new Err('boom'));
    expect(status).toBe(code);
    expect(body).toEqual({ statusCode: code, message: 'boom', requestId: 'req-1' });
  });

  it('keeps the error name and still maps HttpException', () => {
    expect(new NotFoundError('x').name).toBe('NotFoundError');
    expect(run(new HttpException('teapot', 418)).body.message).toBe('teapot');
  });

  it('subclasses of a business error map like their parent', () => {
    class SlugTakenError extends ConflictError {}
    expect(run(new SlugTakenError('slug')).status).toBe(409);
  });
});
