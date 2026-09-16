import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service.js';

@ApiTags('App')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'Health check / greeting endpoint' })
  @ApiOkResponse({ description: 'Greeting message' })
  getHello(): string {
    return this.appService.getHello();
  }
}
