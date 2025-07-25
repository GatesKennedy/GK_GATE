import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  async healthCheck() {
    return this.healthService.check();
  }

  @Get('ready')
  async readinessCheck() {
    return this.healthService.readinessCheck();
  }

  @Get('live')
  async livenessCheck() {
    return this.healthService.livenessCheck();
  }
}