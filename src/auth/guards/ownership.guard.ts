import { CanActivate, ExecutionContext, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { OWNED_RESOURCE_KEY, OwnedResourceOptions } from '../decorators/owned-resource.decorator.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { JwtPayload } from '../strategies/jwt.strategy.js';

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

    // MASTER_ADMIN bypass — không cần kiểm tra ownership.
    if (user.roles.includes('MASTER_ADMIN')) return true;

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
