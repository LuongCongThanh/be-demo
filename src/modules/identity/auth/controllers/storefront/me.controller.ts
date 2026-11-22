import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthorizeAccountType } from '#src/security/authorization/account-type/authorize-account-type.decorator.js';
import { ApiErrorResponses } from '#src/common/swagger/api-error-responses.decorator.js';
import { API_TAGS } from '#src/common/swagger/api-tags.js';
import { CurrentUser } from '#src/security/authentication/current-user.decorator.js';
import type { JwtPayload } from '#src/security/contracts/jwt-payload.js';
import { AccountProfileService } from '#src/modules/identity/auth/services/storefront/account-profile.service.js';
import { CustomerProfileResponseDto } from '#src/modules/identity/auth/dto/storefront/customer-profile-response.dto.js';
import { UpdateCustomerProfileDto } from '#src/modules/identity/auth/dto/storefront/update-customer-profile.dto.js';
import { CustomerAddressDto } from '#src/modules/identity/auth/dto/storefront/customer-address.dto.js';

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

  @Patch()
  @AuthorizeAccountType('CUSTOMER')
  @ApiOperation({ summary: 'Update the signed-in customer profile' })
  @ApiOkResponse({ type: CustomerProfileResponseDto })
  async updateProfile(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateCustomerProfileDto,
  ): Promise<CustomerProfileResponseDto> {
    return this.accountProfileService.updateCustomerProfile(user.sub, dto);
  }

  @Get('addresses')
  @AuthorizeAccountType('CUSTOMER')
  @ApiOperation({ summary: 'List customer delivery addresses' })
  listAddresses(@CurrentUser() user: JwtPayload) {
    return this.accountProfileService.listAddresses(user.sub);
  }

  @Post('addresses')
  @AuthorizeAccountType('CUSTOMER')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a customer delivery address' })
  createAddress(@CurrentUser() user: JwtPayload, @Body() dto: CustomerAddressDto) {
    return this.accountProfileService.createAddress(user.sub, dto);
  }

  @Patch('addresses/:addressId')
  @AuthorizeAccountType('CUSTOMER')
  @ApiOperation({ summary: 'Update a customer delivery address' })
  updateAddress(
    @CurrentUser() user: JwtPayload,
    @Param('addressId') addressId: string,
    @Body() dto: CustomerAddressDto,
  ) {
    return this.accountProfileService.updateAddress(user.sub, addressId, dto);
  }

  @Delete('addresses/:addressId')
  @AuthorizeAccountType('CUSTOMER')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a customer delivery address' })
  async deleteAddress(@CurrentUser() user: JwtPayload, @Param('addressId') addressId: string): Promise<void> {
    await this.accountProfileService.deleteAddress(user.sub, addressId);
  }
}
