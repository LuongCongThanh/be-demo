import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AdminVoucherController } from '#src/modules/voucher/admin-voucher.controller.js';
import { AdminVoucherService } from '#src/modules/voucher/admin-voucher.service.js';

/** Voucher và lượt dùng (BR-VCH-*). Slice B2: back-office CRUD; áp mã khi đặt đơn đến ở slice C. */
@Module({
  // PassportModule cấp AuthModuleOptions cho JwtAuthGuard (@Authorize); strategy 'jwt' do IdentityModule đăng ký.
  imports: [PassportModule.register({})],
  controllers: [AdminVoucherController],
  providers: [AdminVoucherService],
})
export class VoucherModule {}
