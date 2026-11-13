import { applyDecorators } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';
import { ErrorResponseDto } from '#src/common/swagger/error-response.dto.js';

type ErrorStatus = 400 | 401 | 403 | 404 | 409 | 422 | 503;

// `Record<ErrorStatus, …>` buộc mọi status hợp lệ đều có mô tả mặc định.
const DEFAULT_DESCRIPTIONS: Record<ErrorStatus, string> = {
  400: 'Invalid input (validation failed or malformed id)',
  401: 'Missing, invalid, or expired access token',
  403: 'Authenticated user lacks the required permission or account type',
  404: 'Resource not found',
  409: 'Conflicts with existing data',
  422: 'Request is well-formed but cannot be processed',
  503: 'A required external service is not configured or unavailable',
};

/**
 * Khai các response lỗi với body `ErrorResponseDto`. Truyền số để dùng mô tả
 * mặc định, hoặc `[status, description]` để ghi rõ nguyên nhân riêng của route.
 */
export function ApiErrorResponses(...errors: (ErrorStatus | [ErrorStatus, string])[]) {
  return applyDecorators(
    ...errors.map((e) => {
      const [status, description] = Array.isArray(e) ? e : [e, DEFAULT_DESCRIPTIONS[e]];
      return ApiResponse({ status, description, type: ErrorResponseDto });
    }),
  );
}
