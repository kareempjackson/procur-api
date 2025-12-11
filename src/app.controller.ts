import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AppService } from './app.service';
import { Public } from './auth/decorators/public.decorator';

@ApiTags('Health')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: 'Health Check',
    description: 'Check if the API is running',
  })
  @ApiResponse({ status: 200, description: 'API is running successfully' })
  getHello(): string {
    return this.appService.getHello();
  }

  @Public()
  @Get('debug-sentry')
  @ApiOperation({
    summary: 'Trigger a test error for Sentry',
    description:
      'Throws an error to verify that Sentry is correctly capturing exceptions.',
  })
  @ApiResponse({
    status: 500,
    description: 'Intentional error used to test Sentry integration',
  })
  getError() {
    throw new Error('My first Sentry error!');
  }
}
