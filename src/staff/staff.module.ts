import { Module } from '@nestjs/common';
import { AuditModule } from '#src/audit/audit.module.js';
import { AuthModule } from '#src/auth/auth.module.js';
import { StaffController } from '#src/staff/staff.controller.js';
import { StaffService } from '#src/staff/staff.service.js';

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [StaffController],
  providers: [StaffService],
})
export class StaffModule {}
