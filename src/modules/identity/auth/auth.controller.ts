import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Authorize } from '#src/common/auth/authorize.decorator.js';
import type { Request, Response } from 'express';
import ms from 'ms';
import { Throttle } from '@nestjs/throttler';
import { EmailThrottlerGuard } from '#src/modules/identity/auth/email-throttler.guard.js';
import { ResendVerificationDto } from '#src/modules/identity/auth/dto/resend-verification.dto.js';
import { ForgotPasswordDto } from '#src/modules/identity/auth/dto/forgot-password.dto.js';
import { ResetPasswordDto } from '#src/modules/identity/auth/dto/reset-password.dto.js';
import { VerifyEmailDto } from '#src/modules/identity/auth/dto/verify-email.dto.js';
import { LoginDto } from '#src/modules/identity/auth/dto/login.dto.js';
import { LoginResponseDto } from '#src/modules/identity/auth/dto/login-response.dto.js';
import { RefreshResponseDto } from '#src/modules/identity/auth/dto/refresh-response.dto.js';
import { AuthUserResponseDto } from '#src/modules/identity/auth/dto/auth-user-response.dto.js';
import { MessageResponseDto } from '#src/modules/identity/auth/dto/message-response.dto.js';
import { ApiErrorResponses } from '#src/common/swagger/api-error-responses.decorator.js';
import { API_TAGS } from '#src/common/swagger/api-tags.js';
import { RegistrationService } from '#src/modules/identity/auth/registration.service.js';
import { SessionService } from '#src/modules/identity/auth/session.service.js';
import { PasswordResetService } from '#src/modules/identity/auth/password-reset.service.js';
import { AccountProfileService } from '#src/modules/identity/auth/account-profile.service.js';
import { RegisterDto } from '#src/modules/identity/auth/dto/register.dto.js';
import { RegisterResponseDto } from '#src/modules/identity/auth/dto/register-response.dto.js';
import { CurrentUser } from '#src/common/auth/current-user.decorator.js';
import type { JwtPayload } from '#src/common/auth/jwt-payload.js';

// Phải khớp đúng path prefix route auth thực tế của app (với API versioning,
// route thật là '/api/v1/auth'). Dùng chung cho mọi nơi set/clear cookie
// refresh token (login, refresh, logout) để không copy-paste path này rải rác
// và dễ lệch nhau.
const REFRESH_TOKEN_COOKIE_PATH = '/api/v1/auth';

// Mức throttle mặc định (20 request/phút) cho các route không cần siết chặt
// hơn mức global — dùng chung để đổi 1 chỗ thay vì lặp lại object này ở từng
// `@Throttle()` (register, verify-email, refresh).
const DEFAULT_THROTTLE = { default: { limit: 20, ttl: 60_000 } };

@ApiTags(API_TAGS.AUTH.name)
@Controller('auth')
export class AuthController {
  constructor(
    private readonly registrationService: RegistrationService,
    private readonly sessionService: SessionService,
    private readonly passwordResetService: PasswordResetService,
    private readonly accountProfileService: AccountProfileService,
    private readonly config: ConfigService,
  ) {}

  @Throttle(DEFAULT_THROTTLE)
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new CUSTOMER account' })
  @ApiCreatedResponse({ type: RegisterResponseDto })
  @ApiErrorResponses([409, 'Email already exists'], [400, 'Invalid input'])
  async register(@Body() dto: RegisterDto): Promise<RegisterResponseDto> {
    return this.registrationService.register(dto);
  }

  @Throttle(DEFAULT_THROTTLE)
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify email address using the 6-digit code sent by email' })
  @ApiOkResponse({ type: MessageResponseDto, description: 'Email verified successfully' })
  @ApiErrorResponses(
    [404, 'Invalid email or code'],
    [400, 'Invalid input, code already used or expired, or too many attempts'],
  )
  async verifyEmail(@Body() dto: VerifyEmailDto): Promise<MessageResponseDto> {
    return this.registrationService.verifyEmail(dto);
  }

  @UseGuards(EmailThrottlerGuard)
  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend the email verification code' })
  @ApiOkResponse({ type: MessageResponseDto, description: 'A new verification email has been sent (if applicable)' })
  @ApiErrorResponses([400, 'Invalid input'])
  async resendVerification(@Body() dto: ResendVerificationDto): Promise<MessageResponseDto> {
    return this.registrationService.resendVerification(dto);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log in and receive an access token (refresh token is set as an HttpOnly cookie)' })
  @ApiOkResponse({ type: LoginResponseDto })
  @ApiErrorResponses([400, 'Invalid input'], [401, 'Invalid credentials, account locked, or email not verified'])
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) response: Response): Promise<LoginResponseDto> {
    const { accessToken, rawRefreshToken, user } = await this.sessionService.login(dto);

    this.setRefreshTokenCookie(response, rawRefreshToken);

    return { accessToken, user };
  }

  // Route này KHÔNG có JwtAuthGuard — cố ý, vì lúc gọi /auth/refresh access
  // token cũ thường đã hết hạn (đó chính là lý do cần refresh). Route tự xác
  // thực bằng refresh token đọc từ cookie, không phụ thuộc access token.
  @Throttle(DEFAULT_THROTTLE)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate the refresh token cookie and issue a new access token' })
  @ApiOkResponse({ type: RefreshResponseDto })
  @ApiErrorResponses([401, 'Missing, invalid, expired, or reused refresh token'])
  async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response): Promise<RefreshResponseDto> {
    const rawRefreshToken = request.cookies?.[this.getRefreshTokenCookieName()] as string | undefined;

    const { accessToken, newRawRefreshToken } = await this.sessionService.refreshToken(rawRefreshToken);

    this.setRefreshTokenCookie(response, newRawRefreshToken);

    return { accessToken };
  }

  @UseGuards(EmailThrottlerGuard)
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request a password reset email' })
  @ApiOkResponse({ type: MessageResponseDto, description: 'A password reset email has been sent (if applicable)' })
  @ApiErrorResponses([400, 'Invalid input'])
  async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<MessageResponseDto> {
    return this.passwordResetService.forgotPassword(dto);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password using the token received by email' })
  @ApiOkResponse({ type: MessageResponseDto, description: 'Password has been reset' })
  @ApiErrorResponses([400, 'Invalid, expired, or already-used token; or invalid input'])
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<MessageResponseDto> {
    return this.passwordResetService.resetPassword(dto);
  }

  @Get('me')
  @Authorize()
  @ApiOperation({ summary: 'Get the currently authenticated user' })
  @ApiOkResponse({ type: AuthUserResponseDto })
  @ApiErrorResponses(401)
  getMe(@CurrentUser() user: JwtPayload): Promise<AuthUserResponseDto> {
    return this.accountProfileService.getMe(user.sub);
  }

  @Authorize()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log out the current session (revokes its refresh token)' })
  @ApiOkResponse({ type: MessageResponseDto })
  @ApiErrorResponses(401)
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response): Promise<MessageResponseDto> {
    const rawRefreshToken = request.cookies?.[this.getRefreshTokenCookieName()] as string | undefined;

    if (rawRefreshToken) {
      await this.sessionService.logout(rawRefreshToken);
    }

    this.clearRefreshTokenCookie(response);

    return { message: 'Logged out' };
  }

  @Authorize()
  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log out of all sessions (revokes every refresh token of the current user)' })
  @ApiOkResponse({ type: MessageResponseDto })
  @ApiErrorResponses(401)
  async logoutAll(
    @CurrentUser() user: JwtPayload,
    @Res({ passthrough: true }) response: Response,
  ): Promise<MessageResponseDto> {
    await this.sessionService.logoutAll(user.sub);

    this.clearRefreshTokenCookie(response);

    return { message: 'Logged out of all devices' };
  }

  private getRefreshTokenCookieName(): string {
    return this.config.get<string>('REFRESH_TOKEN_COOKIE_NAME', 'refresh_token');
  }

  private setRefreshTokenCookie(response: Response, rawRefreshToken: string): void {
    response.cookie(this.getRefreshTokenCookieName(), rawRefreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: REFRESH_TOKEN_COOKIE_PATH,
      maxAge: ms(this.config.get<string>('REFRESH_TOKEN_TTL', '7d') as ms.StringValue),
    });
  }

  // `path` PHẢI khớp chính xác với path đã dùng lúc `setRefreshTokenCookie()`
  // set ra — xem concept box trong 09-logout.md.
  private clearRefreshTokenCookie(response: Response): void {
    response.clearCookie(this.getRefreshTokenCookieName(), { path: REFRESH_TOKEN_COOKIE_PATH });
  }
}
