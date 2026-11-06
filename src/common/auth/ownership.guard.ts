import { CanActivate, ExecutionContext, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { OWNED_RESOURCE_KEY, OwnedResourceOptions } from '#src/common/auth/owned-resource.decorator.js';
import { PrismaService } from '#src/infrastructure/database/prisma.service.js';
import type { JwtPayload } from '#src/common/auth/jwt-payload.js';

@Injectable()
export class OwnershipGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.get<OwnedResourceOptions>(OWNED_RESOURCE_KEY, context.getHandler());
    if (!options) return true; // route không khai @OwnedResource(...) → không áp dụng

    const request = context.switchToHttp().getRequest();
    const user: JwtPayload | undefined = request.user;
    if (!user) return false; // phải chạy sau JwtAuthGuard

    // ADMIN bypass — không cần kiểm tra ownership.
    if (user.role === 'ADMIN') return true;

    const resourceId = request.params[options.paramIdKey];
    const resource = await options.fetch(resourceId, this.prisma);
    if (!resource) {
      throw new NotFoundException();
    }
    if (resource.userId !== user.sub) {
      throw new ForbiddenException('You do not have permission to access this resource');
    }

    return true;
  }
}
