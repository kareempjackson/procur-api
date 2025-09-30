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
}
