import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { JwtPayload } from '#src/auth/strategies/jwt.strategy.js';

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): JwtPayload => {
  const request = ctx.switchToHttp().getRequest();
  return request.user;
});
