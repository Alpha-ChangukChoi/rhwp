import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return {
      status: 'ok',
      service: 'rhwp-agent-server',
      version: '0.1.0',
    };
  }
}
