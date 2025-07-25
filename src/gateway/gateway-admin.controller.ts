import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators';
import { Permission } from '../auth/types/auth.types';
import { ValidateBody, ValidateParams } from '../validation';
import { RouteConfigSchema, IdParamSchema } from '../validation/common.schemas';
import { RouteConfigService } from './routing/route-config.service';
import { LoadBalancerService } from './load-balancer/load-balancer.service';
import { HealthCheckService } from './routing/health-check.service';
import { AdvancedRateLimitService } from './rate-limit/advanced-rate-limit.service';
import { CircuitBreakerService } from './circuit-breaker/circuit-breaker.service';
import { CacheService } from './cache/cache.service';
import { HttpMethod } from './types/route.types';

@Controller('admin/gateway')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class GatewayAdminController {
  constructor(
    private readonly routeConfigService: RouteConfigService,
    private readonly loadBalancerService: LoadBalancerService,
    private readonly healthCheckService: HealthCheckService,
    private readonly rateLimitService: AdvancedRateLimitService,
    private readonly circuitBreakerService: CircuitBreakerService,
    private readonly cacheService: CacheService,
  ) {}

  // Route Management
  @Get('routes')
  @RequirePermissions(Permission.CONFIGURE_ROUTES)
  async getAllRoutes() {
    const routes = this.routeConfigService.getAllRoutes();
    return {
      message: 'Routes retrieved successfully',
      data: routes,
      total: routes.length,
    };
  }

  @Post('routes')
  @RequirePermissions(Permission.CONFIGURE_ROUTES)
  @ValidateBody(RouteConfigSchema)
  async createRoute(@Body() routeConfig: any) {
    const route = this.routeConfigService.setRoute({
      path: routeConfig.path,
      method: routeConfig.method as HttpMethod,
      targets: routeConfig.targets || [],
      loadBalancer: {
        algorithm: routeConfig.loadBalancer?.algorithm || 'round-robin',
        healthCheck: {
          enabled: true,
          path: '/health',
          interval: 30000,
          timeout: 5000,
          healthyThreshold: 2,
          unhealthyThreshold: 3,
        },
      },
      circuitBreaker: {
        enabled: routeConfig.circuitBreaker?.enabled || true,
        threshold: routeConfig.circuitBreaker?.threshold || 5,
        timeout: routeConfig.circuitBreaker?.timeout || 30000,
        monitorWindow: 60000,
      },
      timeout: routeConfig.timeout || 30000,
      retries: routeConfig.retries || 3,
      isActive: true,
    });

    return {
      message: 'Route created successfully',
      data: route,
    };
  }

  @Delete('routes/:method/:path')
  @RequirePermissions(Permission.CONFIGURE_ROUTES)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteRoute(
    @Param('method') method: string,
    @Param('path') path: string,
  ) {
    const deleted = this.routeConfigService.removeRoute(
      `/${path}`,
      method.toUpperCase() as HttpMethod
    );

    if (!deleted) {
      return {
        message: 'Route not found',
        statusCode: 404,
      };
    }

    return {
      message: 'Route deleted successfully',
    };
  }

  // Health Check Management
  @Get('health')
  @RequirePermissions(Permission.VIEW_METRICS)
  async getHealthStatus() {
    const healthStatus = this.healthCheckService.getHealthStatus();
    return {
      message: 'Health status retrieved successfully',
      data: healthStatus,
    };
  }

  @Post('health/check/:routeId')
  @RequirePermissions(Permission.CONFIGURE_ROUTES)
  @ValidateParams(IdParamSchema)
  async forceHealthCheck(@Param('routeId') routeId: string) {
    try {
      await this.healthCheckService.forceHealthCheck(routeId);
      return {
        message: 'Health check completed successfully',
        routeId,
      };
    } catch (error) {
      return {
        message: (error as Error).message,
        statusCode: 404,
      };
    }
  }

  // Load Balancer Statistics
  @Get('load-balancer/stats')
  @RequirePermissions(Permission.VIEW_METRICS)
  async getLoadBalancerStats() {
    const stats = this.loadBalancerService.getStats();
    return {
      message: 'Load balancer statistics retrieved successfully',
      data: stats,
    };
  }

  @Post('load-balancer/reset')
  @RequirePermissions(Permission.MANAGE_RATE_LIMITS)
  @HttpCode(HttpStatus.NO_CONTENT)
  async resetLoadBalancerStats() {
    this.loadBalancerService.resetStats();
    return {
      message: 'Load balancer statistics reset successfully',
    };
  }

  // Rate Limiting Management
  @Get('rate-limit/stats')
  @RequirePermissions(Permission.VIEW_METRICS)
  async getRateLimitStats() {
    const stats = this.rateLimitService.getStats();
    return {
      message: 'Rate limit statistics retrieved successfully',
      data: stats,
    };
  }

  @Post('rate-limit/reset')
  @RequirePermissions(Permission.MANAGE_RATE_LIMITS)
  @HttpCode(HttpStatus.NO_CONTENT)
  async resetRateLimits() {
    this.rateLimitService.resetAllRateLimits();
    return {
      message: 'Rate limits reset successfully',
    };
  }

  @Delete('rate-limit/:key')
  @RequirePermissions(Permission.MANAGE_RATE_LIMITS)
  async resetSpecificRateLimit(@Param('key') key: string) {
    const reset = this.rateLimitService.resetRateLimit(key);
    
    if (!reset) {
      return {
        message: 'Rate limit key not found',
        statusCode: 404,
      };
    }

    return {
      message: 'Rate limit reset successfully',
      key,
    };
  }

  // Circuit Breaker Management
  @Get('circuit-breaker/stats')
  @RequirePermissions(Permission.VIEW_METRICS)
  async getCircuitBreakerStats() {
    const stats = this.circuitBreakerService.getAllStats();
    return {
      message: 'Circuit breaker statistics retrieved successfully',
      data: stats,
    };
  }

  @Post('circuit-breaker/reset')
  @RequirePermissions(Permission.MANAGE_RATE_LIMITS)
  @HttpCode(HttpStatus.NO_CONTENT)
  async resetAllCircuitBreakers() {
    const resetCount = this.circuitBreakerService.resetAll();
    return {
      message: `Reset ${resetCount} circuit breakers successfully`,
    };
  }

  // Cache Management
  @Get('cache/stats')
  @RequirePermissions(Permission.VIEW_METRICS)
  async getCacheStats() {
    const stats = this.cacheService.getStats();
    return {
      message: 'Cache statistics retrieved successfully',
      data: stats,
    };
  }

  @Post('cache/clear')
  @RequirePermissions(Permission.MANAGE_RATE_LIMITS)
  @HttpCode(HttpStatus.NO_CONTENT)
  async clearCache() {
    this.cacheService.clear();
    return {
      message: 'Cache cleared successfully',
    };
  }

  @Delete('cache/:key')
  @RequirePermissions(Permission.MANAGE_RATE_LIMITS)
  async deleteCacheEntry(@Param('key') key: string) {
    const deleted = this.cacheService.delete(key);
    
    if (!deleted) {
      return {
        message: 'Cache key not found',
        statusCode: 404,
      };
    }

    return {
      message: 'Cache entry deleted successfully',
      key,
    };
  }

  // Gateway Overview
  @Get('overview')
  @RequirePermissions(Permission.VIEW_METRICS)
  async getGatewayOverview() {
    const routes = this.routeConfigService.getAllRoutes();
    const healthStatus = this.healthCheckService.getHealthStatus();
    const loadBalancerStats = this.loadBalancerService.getStats();
    const rateLimitStats = this.rateLimitService.getStats();
    const circuitBreakerStats = this.circuitBreakerService.getAllStats();
    const cacheStats = this.cacheService.getStats();

    const overview = {
      routes: {
        total: routes.length,
        active: routes.filter(r => r.isActive).length,
        inactive: routes.filter(r => !r.isActive).length,
      },
      targets: {
        total: routes.reduce((sum, route) => sum + route.targets.length, 0),
        healthy: healthStatus.routes.reduce((sum, route) => sum + route.healthyTargets, 0),
        unhealthy: healthStatus.routes.reduce((sum, route) => sum + (route.totalTargets - route.healthyTargets), 0),
      },
      loadBalancer: {
        totalRoutes: loadBalancerStats.totalRoutes,
        totalConnections: loadBalancerStats.totalConnections,
      },
      rateLimit: {
        activeWindows: rateLimitStats.activeWindows,
        totalWindows: rateLimitStats.totalWindows,
      },
      circuitBreaker: {
        totalCircuitBreakers: Object.keys(circuitBreakerStats).length,
        openCircuitBreakers: Object.values(circuitBreakerStats).filter(s => s.state === 'OPEN').length,
        halfOpenCircuitBreakers: Object.values(circuitBreakerStats).filter(s => s.state === 'HALF_OPEN').length,
      },
      cache: {
        totalEntries: cacheStats.totalEntries,
        hitRate: cacheStats.hitRate,
        totalSize: cacheStats.totalSize,
      },
      timestamp: new Date().toISOString(),
    };

    return {
      message: 'Gateway overview retrieved successfully',
      data: overview,
    };
  }
}