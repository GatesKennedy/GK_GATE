import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';

// Controllers
import { GatewayController } from './gateway.controller';

// Services
import { RouteConfigService } from './routing/route-config.service';
import { ProxyService } from './routing/proxy.service';
import { HealthCheckService } from './routing/health-check.service';
import { LoadBalancerService } from './load-balancer/load-balancer.service';
import { AdvancedRateLimitService } from './rate-limit/advanced-rate-limit.service';

// Interceptors
import { RateLimitInterceptor } from './rate-limit/rate-limit.interceptor';

@Module({
  controllers: [GatewayController],
  providers: [
    // Core services
    RouteConfigService,
    ProxyService,
    HealthCheckService,
    LoadBalancerService,
    AdvancedRateLimitService,
    
    // Global interceptors
    {
      provide: APP_INTERCEPTOR,
      useClass: RateLimitInterceptor,
    },
  ],
  exports: [
    RouteConfigService,
    ProxyService,
    HealthCheckService,
    LoadBalancerService,
    AdvancedRateLimitService,
  ],
})
export class GatewayModule {}