import { Injectable } from '@nestjs/common';
import { PrismaService } from '#src/infrastructure/database/prisma.service.js';
import { CustomerProfileResponseDto } from '#src/modules/identity/auth/dto/customer-profile-response.dto.js';
import type { JwtPayload } from '#src/common/auth/jwt-payload.js';
import { MeResponseDto } from '#src/modules/identity/auth/dto/auth-user-response.dto.js';

@Injectable()
export class AccountProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async getMe(userId: string, claims: Pick<JwtPayload, 'roles' | 'permissions'>): Promise<MeResponseDto> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    // Map thủ công sang DTO allow-list — KHÔNG return thẳng `user` (có passwordHash).
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      emailVerified: user.emailVerifiedAt !== null,
      // Từ access token (đúng thứ guard đang áp dụng), không đọc lại DB.
      roles: claims.roles ?? [],
      permissions: claims.permissions ?? [],
    };
  }

  async getCustomerProfile(userId: string): Promise<CustomerProfileResponseDto> {
    return this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, email: true, fullName: true, phone: true },
    });
  }
}
