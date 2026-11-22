import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CartService } from '#src/modules/cart/cart.service.js';
import { AddCartItemDto, UpdateCartItemDto } from '#src/modules/cart/dto/cart.dto.js';
import { AuthorizeAccountType } from '#src/security/authorization/account-type/authorize-account-type.decorator.js';
import { CurrentUser } from '#src/security/authentication/current-user.decorator.js';
import type { JwtPayload } from '#src/security/contracts/jwt-payload.js';

@ApiTags('Cart')
@Controller('cart')
export class CartController {
  constructor(private readonly service: CartService) {}

  @Get()
  @ApiOperation({ summary: 'Get or create a guest cart' })
  getGuest(@Req() request: Request) {
    return this.service.getGuestCart(this.sessionId(request));
  }

  @Post('items')
  @ApiOperation({ summary: 'Add a variant to a guest cart' })
  addGuest(@Req() request: Request, @Body() dto: AddCartItemDto) {
    return this.service.addGuestItem(this.sessionId(request), dto);
  }

  @Patch('items/:itemId')
  @ApiOperation({ summary: 'Update a guest cart item quantity' })
  updateGuest(@Req() request: Request, @Param('itemId') itemId: string, @Body() dto: UpdateCartItemDto) {
    return this.service.updateGuestItem(this.sessionId(request), itemId, dto.quantity);
  }

  @Delete('items/:itemId')
  @ApiOperation({ summary: 'Remove a guest cart item' })
  deleteGuest(@Req() request: Request, @Param('itemId') itemId: string) {
    return this.service.deleteGuestItem(this.sessionId(request), itemId);
  }

  @Post('merge')
  @AuthorizeAccountType('CUSTOMER')
  @ApiOperation({ summary: 'Merge a guest cart into the signed-in Customer cart' })
  merge(@CurrentUser() user: JwtPayload, @Req() request: Request) {
    const sessionId = this.sessionId(request);
    if (!sessionId) throw new BadRequestException('X-Cart-Session is required');
    return this.service.mergeGuestCart(user.sub, sessionId);
  }

  @Get('me')
  @AuthorizeAccountType('CUSTOMER')
  @ApiOperation({ summary: 'Get the signed-in Customer cart' })
  getCustomer(@CurrentUser() user: JwtPayload) {
    return this.service.getCustomerCart(user.sub);
  }

  @Post('me/items')
  @AuthorizeAccountType('CUSTOMER')
  @ApiOperation({ summary: 'Add a variant to the signed-in Customer cart' })
  addCustomer(@CurrentUser() user: JwtPayload, @Body() dto: AddCartItemDto) {
    return this.service.addCustomerItem(user.sub, dto);
  }

  @Patch('me/items/:itemId')
  @AuthorizeAccountType('CUSTOMER')
  @ApiOperation({ summary: 'Update a signed-in Customer cart item quantity' })
  updateCustomer(
    @CurrentUser() user: JwtPayload,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateCartItemDto,
  ) {
    return this.service.updateCustomerItem(user.sub, itemId, dto.quantity);
  }

  @Delete('me/items/:itemId')
  @AuthorizeAccountType('CUSTOMER')
  @ApiOperation({ summary: 'Remove a signed-in Customer cart item' })
  deleteCustomer(@CurrentUser() user: JwtPayload, @Param('itemId') itemId: string) {
    return this.service.deleteCustomerItem(user.sub, itemId);
  }

  private sessionId(request: Request): string | undefined {
    const value = request.headers['x-cart-session'];
    return Array.isArray(value) ? value[0] : value;
  }
}
