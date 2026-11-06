import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { API_TAGS } from '#src/common/swagger/api-tags.js';
import { ErrorResponseDto } from '#src/common/swagger/error-response.dto.js';
import { PrismaHealthIndicator } from '#src/infrastructure/observability/health/prisma-health.indicator.js';

@ApiTags(API_TAGS.HEALTH.name)
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaHealth: PrismaHealthIndicator,
  ) {}

  // Luôn 200 nếu process còn nhận request — không check dependency nào.
  @Get('live')
  @ApiOperation({ summary: 'Report that the process is alive (no dependency checks)' })
  @ApiOkResponse({ schema: { example: { status: 'ok' } } })
  live() {
    return { status: 'ok' };
  }

  // Chỉ phụ thuộc Postgres (ADR 0008) — Redis down không làm route này 503.
  @Get('ready')
  // swaggerDocumentation: false — schema 503 Terminus tự sinh ({status, info,
  // error, details}) không đúng thực tế: AllExceptionsFilter chuẩn hoá mọi lỗi
  // về ErrorResponseDto, nên tự khai response bên dưới.
  @HealthCheck({ noCache: true, swaggerDocumentation: false })
  @ApiOperation({ summary: 'Report whether the app can serve traffic (checks Postgres)' })
  @ApiOkResponse({
    schema: {
      example: {
        status: 'ok',
        info: { postgres: { status: 'up' } },
        error: {},
        details: { postgres: { status: 'up' } },
      },
    },
  })
  @ApiServiceUnavailableResponse({ type: ErrorResponseDto, description: 'Postgres is unreachable' })
  ready() {
    return this.health.check([() => this.prismaHealth.isHealthy()]);
  }
}
