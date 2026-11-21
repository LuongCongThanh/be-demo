import {
  BadRequestException,
  CallHandler,
  ConflictException,
  ExecutionContext,
  HttpException,
  Injectable,
  NestInterceptor,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { catchError, Observable, throwError } from 'rxjs';
import {
  CategoryConflictError,
  CategoryDomainError,
  CategoryImageUploadError,
  CategoryInvalidInputError,
  CategoryNotFoundError,
} from '#src/modules/catalog/category/domain/errors/category-errors.js';

@Injectable()
export class CategoryErrorMappingInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next
      .handle()
      .pipe(
        catchError((error: unknown) =>
          throwError(() => (error instanceof CategoryDomainError ? mapCategoryErrorToHttpException(error) : error)),
        ),
      );
  }
}

export function mapCategoryErrorToHttpException(error: CategoryDomainError): HttpException {
  if (error instanceof CategoryNotFoundError) return new NotFoundException(error.message);
  if (error instanceof CategoryConflictError) return new ConflictException(error.message);
  if (error instanceof CategoryImageUploadError) return new UnprocessableEntityException(error.message);
  if (error instanceof CategoryInvalidInputError) return new BadRequestException(error.message);
  throw new Error('Unmapped Category domain error');
}
