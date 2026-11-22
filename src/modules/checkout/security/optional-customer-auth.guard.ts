import { ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import type { JwtPayload } from '#src/security/contracts/jwt-payload.js';

interface CheckoutRequest extends Request {
  user?: JwtPayload;
}

@Injectable()
export class OptionalCustomerAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<CheckoutRequest>();
    if (!request.headers.authorization) return true;
    return super.canActivate(context);
  }

  handleRequest<TUser = JwtPayload>(error: unknown, user: TUser | false | null | undefined): TUser {
    if (error || !user) throw error ?? new UnauthorizedException();
    const payload = user as unknown as JwtPayload;
    if (payload.role !== 'CUSTOMER') throw new ForbiddenException('Only customer accounts may place storefront orders');
    return user as TUser;
  }
}
