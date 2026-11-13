import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Authorize } from '#src/common/auth/authorize.decorator.js';
import { ApiErrorResponses } from '#src/common/swagger/api-error-responses.decorator.js';
import { API_TAGS } from '#src/common/swagger/api-tags.js';
import { CurrentUser } from '#src/common/auth/current-user.decorator.js';
import type { JwtPayload } from '#src/common/auth/jwt-payload.js';
import { AccountProfileService } from '#src/modules/identity/auth/account-profile.service.js';
import { CustomerProfileResponseDto } from '#src/modules/identity/auth/dto/customer-profile-response.dto.js';

/**
 * Hồ sơ Khách hàng (identity.md §4, US-505) — route mua hàng đầu tiên, chỉ
 * `CUSTOMER`. Khác `GET /auth/me` (mọi vai trò, phục vụ khôi phục phiên).
 */
@ApiTags(API_TAGS.AUTH.name)
@Controller('me')
export class MeController {
  constructor(private readonly accountProfileService: AccountProfileService) {}

  @Get()
  @Authorize('CUSTOMER')
  @ApiOperation({ summary: 'Get the signed-in customer profile (CUSTOMER only)' })
  @ApiOkResponse({ type: CustomerProfileResponseDto })
  @ApiErrorResponses(401, 403)
  getProfile(@CurrentUser() user: JwtPayload): Promise<CustomerProfileResponseDto> {
    return this.accountProfileService.getCustomerProfile(user.sub);
  }
}
