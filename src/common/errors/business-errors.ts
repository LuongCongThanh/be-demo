/**
 * Lỗi nghiệp vụ dùng chung cho `domain/` và `application/`. Không import
 * NestJS: `AllExceptionsFilter` (lớp HTTP) đổi từng loại sang status tương ứng.
 */
export abstract class BusinessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** HTTP 404. */
export class NotFoundError extends BusinessError {}

/** HTTP 409. */
export class ConflictError extends BusinessError {}

/** HTTP 400. */
export class InvalidInputError extends BusinessError {}

/** HTTP 422. */
export class UnprocessableError extends BusinessError {}

/** HTTP 401. */
export class UnauthenticatedError extends BusinessError {}

/** HTTP 403. */
export class ForbiddenError extends BusinessError {}
