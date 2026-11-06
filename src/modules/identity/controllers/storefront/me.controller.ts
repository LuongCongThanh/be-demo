import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiErrorResponses } from '#src/common/swagger/api-error-responses.decorator.js';
import { API_TAGS } from '#src/common/swagger/api-tags.js';
import { JwtAuthGuard } from '#src/auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '#src/auth/guards/roles.guard.js';
import { Roles } from '#src/auth/decorators/roles.decorator.js';
import { CurrentUser } from '#src/auth/decorators/current-user.decorator.js';
import type { JwtPayload } from '#src/modules/identity/strategies/jwt.strategy.js';
import { AuthService } from '#src/modules/identity/services/auth/auth.service.js';
import { CustomerProfileResponseDto } from '#src/modules/identity/dto/auth/customer-profile-response.dto.js';

/**
 * Hồ sơ Khách hàng (identity.md §4, US-505) — route mua hàng đầu tiên, chỉ
 * `CUSTOMER`. Khác `GET /auth/me` (mọi vai trò, phục vụ khôi phục phiên).
 */
@ApiTags(API_TAGS.AUTH.name)
@Controller('me')
export class MeController {
  constructor(private readonly authService: AuthService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CUSTOMER')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the signed-in customer profile (CUSTOMER only)' })
  @ApiOkResponse({ type: CustomerProfileResponseDto })
  @ApiErrorResponses(401, 403)
  getProfile(@CurrentUser() user: JwtPayload): Promise<CustomerProfileResponseDto> {
    return this.authService.getCustomerProfile(user.sub);
  }
}
