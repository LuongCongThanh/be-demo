import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { JwtPayload } from '#src/common/auth/jwt-payload.js';

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): JwtPayload => {
  const request = ctx.switchToHttp().getRequest();
  return request.user;
});
