import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { OptionValuesController } from './option-values.controller.js';
import { OptionValuesService } from './option-values.service.js';

@Module({
  imports: [AuthModule],
  controllers: [OptionValuesController],
  providers: [OptionValuesService],
})
export class OptionValuesModule {}
