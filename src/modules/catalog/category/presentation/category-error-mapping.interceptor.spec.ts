import type { ExecutionContext } from '@nestjs/common';
import { firstValueFrom, throwError } from 'rxjs';
import { describe, expect, it } from 'vitest';
import {
  CategoryConflictError,
  CategoryImageUploadError,
  CategoryInvalidInputError,
  CategoryNotFoundError,
} from '#src/modules/catalog/category/domain/errors/category-errors.js';
import {
  CategoryErrorMappingInterceptor,
  mapCategoryErrorToHttpException,
} from '#src/modules/catalog/category/presentation/category-error-mapping.interceptor.js';

describe('CategoryErrorMappingInterceptor', () => {
  it.each([
    [new CategoryInvalidInputError('invalid'), 400],
    [new CategoryNotFoundError('missing'), 404],
    [new CategoryConflictError('conflict'), 409],
    [new CategoryImageUploadError('invalid image'), 422],
  ])('maps %s to HTTP %i', (error, status) => {
    expect(mapCategoryErrorToHttpException(error).getStatus()).toBe(status);
  });

  it('maps domain failures while preserving unrelated errors', async () => {
    const interceptor = new CategoryErrorMappingInterceptor();
    const domainError = new CategoryNotFoundError('missing');
    const next = { handle: () => throwError(() => domainError) };

    await expect(firstValueFrom(interceptor.intercept({} as ExecutionContext, next))).rejects.toMatchObject({
      status: 404,
    });

    const infrastructureError = new Error('infrastructure failure');
    await expect(
      firstValueFrom(
        interceptor.intercept({} as ExecutionContext, { handle: () => throwError(() => infrastructureError) }),
      ),
    ).rejects.toBe(infrastructureError);
  });
});
