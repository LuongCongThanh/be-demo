import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AdminVoucherController } from '#src/modules/voucher/admin/controllers/admin-voucher.controller.js';
import { AdminVoucherService } from '#src/modules/voucher/application/admin-voucher.service.js';
import { VoucherRepository } from '#src/modules/voucher/application/ports/voucher.repository.js';
import { VoucherService } from '#src/modules/voucher/application/voucher.service.js';
import { PrismaVoucherRepository } from '#src/modules/voucher/infrastructure/prisma-voucher.repository.js';

/** Voucher và lượt dùng (BR-VCH-*). Back-office CRUD; `VoucherService` (public) cho checkout áp mã. */
@Module({
  // PassportModule cấp AuthModuleOptions cho JwtAuthGuard (@Authorize); strategy 'jwt' do IdentityModule đăng ký.
  imports: [PassportModule.register({})],
  controllers: [AdminVoucherController],
  providers: [
    AdminVoucherService,
    VoucherService,
    PrismaVoucherRepository,
    { provide: VoucherRepository, useExisting: PrismaVoucherRepository },
  ],
  exports: [VoucherService],
})
export class VoucherModule {}
