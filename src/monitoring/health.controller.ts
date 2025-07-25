import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service';
import { Public } from '../auth/decorators';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Public()
  @Get()
  async healthCheck() {
    return this.healthService.check();
  }

  @Public()
  @Get('ready')
  async readinessCheck() {
    return this.healthService.readinessCheck();
  }

  @Public()
  @Get('live')
  async livenessCheck() {
    return this.healthService.livenessCheck();
  }
}