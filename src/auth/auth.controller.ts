import { Body, Controller, HttpCode, HttpStatus, Post, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import ms from 'ms';
import { ResendVerificationDto } from './dto/resend-verification.dto.js';
import { VerifyEmailDto } from './dto/verify-email.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { LoginResponseDto } from './dto/login-response.dto.js';
import { MessageResponseDto } from './dto/message-response.dto.js';
import { AuthService } from './services/auth.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { RegisterResponseDto } from './dto/register-response.dto.js';

// Phải khớp đúng path prefix route auth thực tế của app (main.ts hiện không
// set global prefix, nên route thật là '/auth/*'). Dùng chung cho mọi nơi
// set/clear cookie refresh token (login, refresh, logout) để không copy-paste
// path này rải rác và dễ lệch nhau.
const REFRESH_TOKEN_COOKIE_PATH = '/auth';

@ApiTags('Authentication & Authorization')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new CUSTOMER account' })
  @ApiCreatedResponse({ type: RegisterResponseDto })
  @ApiConflictResponse({ description: 'Email already exists' })
  @ApiBadRequestResponse({ description: 'Invalid input' })
  async register(@Body() dto: RegisterDto): Promise<RegisterResponseDto> {
    return this.authService.register(dto);
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify email address using the 6-digit code sent by email' })
  @ApiOkResponse({ type: MessageResponseDto, description: 'Email verified successfully' })
  @ApiNotFoundResponse({ description: 'Invalid email or code' })
  @ApiBadRequestResponse({ description: 'Code already used or expired' })
  async verifyEmail(@Body() dto: VerifyEmailDto): Promise<MessageResponseDto> {
    return this.authService.verifyEmail(dto);
  }

  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend the email verification code' })
  @ApiOkResponse({ type: MessageResponseDto, description: 'A new verification email has been sent (if applicable)' })
  @ApiBadRequestResponse({ description: 'Invalid input' })
  async resendVerification(@Body() dto: ResendVerificationDto): Promise<MessageResponseDto> {
    return this.authService.resendVerification(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log in and receive an access token (refresh token is set as an HttpOnly cookie)' })
  @ApiOkResponse({ type: LoginResponseDto })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials, account locked, or email not verified' })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) response: Response): Promise<LoginResponseDto> {
    const { accessToken, rawRefreshToken, user } = await this.authService.login(dto);

    this.setRefreshTokenCookie(response, rawRefreshToken);

    return { accessToken, user };
  }

  private setRefreshTokenCookie(response: Response, rawRefreshToken: string): void {
    const cookieName = this.config.get<string>('REFRESH_TOKEN_COOKIE_NAME', 'refresh_token');
    response.cookie(cookieName, rawRefreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: REFRESH_TOKEN_COOKIE_PATH,
      maxAge: ms(this.config.get<string>('REFRESH_TOKEN_TTL', '7d') as ms.StringValue),
    });
  }
}
