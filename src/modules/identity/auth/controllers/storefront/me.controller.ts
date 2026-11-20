import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthorizeAccountType } from '#src/security/authorization/account-type/authorize-account-type.decorator.js';
import { ApiErrorResponses } from '#src/common/swagger/api-error-responses.decorator.js';
import { API_TAGS } from '#src/common/swagger/api-tags.js';
import { CurrentUser } from '#src/security/authentication/current-user.decorator.js';
import type { JwtPayload } from '#src/security/contracts/jwt-payload.js';
import { AccountProfileService } from '#src/modules/identity/auth/services/storefront/account-profile.service.js';
import { CustomerProfileResponseDto } from '#src/modules/identity/auth/dto/storefront/customer-profile-response.dto.js';

/**
 * Hồ sơ Khách hàng (identity.md §4, US-505) — route mua hàng đầu tiên, chỉ
 * `CUSTOMER`. Khác `GET /auth/me` (mọi vai trò, phục vụ khôi phục phiên).
 */
@ApiTags(API_TAGS.STOREFRONT_AUTH.name)
@Controller('me')
export class MeController {
  constructor(private readonly accountProfileService: AccountProfileService) {}

  @Get()
  @AuthorizeAccountType('CUSTOMER')
  @ApiOperation({ summary: 'Get the signed-in customer profile (CUSTOMER only)' })
  @ApiOkResponse({ type: CustomerProfileResponseDto })
  @ApiErrorResponses(401, 403)
  getProfile(@CurrentUser() user: JwtPayload): Promise<CustomerProfileResponseDto> {
    return this.accountProfileService.getCustomerProfile(user.sub);
  }
}
