import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '#src/infrastructure/database/prisma.service.js';
import { CustomerProfileResponseDto } from '#src/modules/identity/auth/dto/storefront/customer-profile-response.dto.js';
import type { JwtPayload } from '#src/security/contracts/jwt-payload.js';
import { MeResponseDto } from '#src/modules/identity/auth/dto/storefront/auth-user-response.dto.js';
import { UpdateCustomerProfileDto } from '#src/modules/identity/auth/dto/storefront/update-customer-profile.dto.js';
import { CustomerAddressDto } from '#src/modules/identity/auth/dto/storefront/customer-address.dto.js';

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
    const profile = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        interfaceLocale: true,
        emailLocale: true,
      },
    });
    return {
      ...profile,
      interfaceLocale: profile.interfaceLocale === 'en' ? 'en' : 'vi',
      emailLocale: profile.emailLocale === 'en' ? 'en' : 'vi',
    };
  }

  async updateCustomerProfile(userId: string, dto: UpdateCustomerProfileDto): Promise<CustomerProfileResponseDto> {
    const profile = await this.prisma.user.update({
      where: { id: userId, role: 'CUSTOMER' },
      data: dto,
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        interfaceLocale: true,
        emailLocale: true,
      },
    });
    return {
      ...profile,
      interfaceLocale: profile.interfaceLocale === 'en' ? 'en' : 'vi',
      emailLocale: profile.emailLocale === 'en' ? 'en' : 'vi',
    };
  }

  listAddresses(userId: string) {
    return this.prisma.customerAddress.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async createAddress(userId: string, dto: CustomerAddressDto) {
    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.customerAddress.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } });
      }
      return tx.customerAddress.create({ data: { ...dto, userId } });
    });
  }

  async updateAddress(userId: string, addressId: string, dto: CustomerAddressDto) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.customerAddress.findFirst({ where: { id: addressId, userId } });
      if (!existing) throw new NotFoundException('Address not found');
      if (dto.isDefault) {
        await tx.customerAddress.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } });
      }
      return tx.customerAddress.update({ where: { id: addressId }, data: dto });
    });
  }

  async deleteAddress(userId: string, addressId: string): Promise<void> {
    const result = await this.prisma.customerAddress.deleteMany({ where: { id: addressId, userId } });
    if (result.count === 0) throw new NotFoundException('Address not found');
  }
}
