import { Injectable } from '@nestjs/common';

export interface HealthCheckResult {
  status: 'ok' | 'error';
  timestamp: string;
  uptime: number;
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  version?: string;
  environment?: string;
  services?: Record<string, 'healthy' | 'unhealthy'>;
}

@Injectable()
export class HealthService {
  private readonly startTime = Date.now();

  async check(): Promise<HealthCheckResult> {
    const memoryUsage = process.memoryUsage();
    const totalMemory = memoryUsage.heapTotal;
    const usedMemory = memoryUsage.heapUsed;

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      memory: {
        used: usedMemory,
        total: totalMemory,
        percentage: Math.round((usedMemory / totalMemory) * 100),
      },
      version: process.env.APP_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
    };
  }

  async readinessCheck(): Promise<HealthCheckResult> {
    // Check if the application is ready to receive traffic
    // This includes checking database connections, external services, etc.
    const baseHealth = await this.check();
    
    const services = await this.checkServices();
    const allServicesHealthy = Object.values(services).every(
      status => status === 'healthy'
    );

    return {
      ...baseHealth,
      status: allServicesHealthy ? 'ok' : 'error',
      services,
    };
  }

  async livenessCheck(): Promise<HealthCheckResult> {
    // Simple liveness check - just verify the process is running
    return this.check();
  }

  private async checkServices(): Promise<Record<string, 'healthy' | 'unhealthy'>> {
    // For now, return empty object. This will be expanded as we add services
    // like database connections, external APIs, etc.
    return {};
  }
}