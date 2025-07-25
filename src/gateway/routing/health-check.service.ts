import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { RouteConfigService } from './route-config.service';
import { ProxyService } from './proxy.service';
import { RouteTarget, HealthCheckConfig } from '../types/route.types';

@Injectable()
export class HealthCheckService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(HealthCheckService.name);
  private healthCheckIntervals = new Map<string, NodeJS.Timeout>();
  private isShuttingDown = false;

  constructor(
    private readonly routeConfigService: RouteConfigService,
    private readonly proxyService: ProxyService,
  ) {}

  onModuleInit() {
    this.initializeHealthChecks();
  }

  onModuleDestroy() {
    this.isShuttingDown = true;
    this.stopAllHealthChecks();
  }

  /**
   * Initialize health checks for all routes
   */
  private initializeHealthChecks(): void {
    const routes = this.routeConfigService.getAllRoutes();
    
    for (const route of routes) {
      if (route.loadBalancer.healthCheck.enabled) {
        this.startHealthCheckForRoute(route.id, route.loadBalancer.healthCheck, route.targets);
      }
    }

    this.logger.log(`Health checks initialized for ${routes.length} routes`);
  }

  /**
   * Start health check for a specific route
   */
  startHealthCheckForRoute(
    routeId: string,
    healthConfig: HealthCheckConfig,
    targets: RouteTarget[]
  ): void {
    // Stop existing health check if any
    this.stopHealthCheckForRoute(routeId);

    const interval = setInterval(async () => {
      if (this.isShuttingDown) return;

      await this.performHealthChecks(routeId, healthConfig, targets);
    }, healthConfig.interval);

    this.healthCheckIntervals.set(routeId, interval);
    
    // Perform initial health check
    setImmediate(() => {
      this.performHealthChecks(routeId, healthConfig, targets);
    });

    this.logger.debug(`Health check started for route ${routeId} (interval: ${healthConfig.interval}ms)`);
  }

  /**
   * Stop health check for a specific route
   */
  stopHealthCheckForRoute(routeId: string): void {
    const interval = this.healthCheckIntervals.get(routeId);
    if (interval) {
      clearInterval(interval);
      this.healthCheckIntervals.delete(routeId);
      this.logger.debug(`Health check stopped for route ${routeId}`);
    }
  }

  /**
   * Stop all health checks
   */
  private stopAllHealthChecks(): void {
    for (const [routeId, interval] of this.healthCheckIntervals) {
      clearInterval(interval);
      this.logger.debug(`Health check stopped for route ${routeId}`);
    }
    this.healthCheckIntervals.clear();
  }

  /**
   * Perform health checks for all targets of a route
   */
  private async performHealthChecks(
    routeId: string,
    healthConfig: HealthCheckConfig,
    targets: RouteTarget[]
  ): Promise<void> {
    const healthCheckPromises = targets.map(target =>
      this.checkTargetHealth(routeId, target, healthConfig)
    );

    try {
      await Promise.allSettled(healthCheckPromises);
    } catch (error) {
      this.logger.error(`Error during health checks for route ${routeId}:`, error);
    }
  }

  /**
   * Check health of a specific target
   */
  private async checkTargetHealth(
    routeId: string,
    target: RouteTarget,
    healthConfig: HealthCheckConfig
  ): Promise<void> {
    const startTime = Date.now();

    try {
      const isHealthy = await this.proxyService.healthCheck(
        target,
        healthConfig.path,
        healthConfig.timeout
      );

      const responseTime = Date.now() - startTime;
      
      // Update target health status
      this.updateTargetHealthStatus(routeId, target, isHealthy, responseTime);

      this.logger.debug(
        `Health check for ${target.url}: ${isHealthy ? 'HEALTHY' : 'UNHEALTHY'} (${responseTime}ms)`
      );
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.updateTargetHealthStatus(routeId, target, false, responseTime);
      
      this.logger.warn(`Health check failed for ${target.url}:`, error);
    }
  }

  /**
   * Update target health status with circuit breaker logic
   */
  private updateTargetHealthStatus(
    routeId: string,
    target: RouteTarget,
    isCurrentlyHealthy: boolean,
    responseTime: number
  ): void {
    const previousHealth = target.isHealthy;
    
    // Update response time
    target.responseTime = responseTime;
    target.lastHealthCheck = new Date();

    if (isCurrentlyHealthy) {
      // Reset error count on successful health check
      target.errorCount = Math.max(0, target.errorCount - 1);
      
      // Mark as healthy if it wasn't before
      if (!target.isHealthy) {
        target.isHealthy = true;
        this.logger.log(`Target ${target.url} is now HEALTHY`);
      }
    } else {
      // Increment error count on failed health check
      target.errorCount++;
      
      // Mark as unhealthy if error count exceeds threshold
      if (target.isHealthy) {
        target.isHealthy = false;
        this.logger.warn(`Target ${target.url} is now UNHEALTHY (errors: ${target.errorCount})`);
      }
    }

    // Log health status changes
    if (previousHealth !== target.isHealthy) {
      this.notifyHealthStatusChange(routeId, target, previousHealth);
    }
  }

  /**
   * Notify when target health status changes
   */
  private notifyHealthStatusChange(
    routeId: string,
    target: RouteTarget,
    previousHealth: boolean
  ): void {
    const status = target.isHealthy ? 'HEALTHY' : 'UNHEALTHY';
    const change = previousHealth ? 'DEGRADED' : 'RECOVERED';
    
    this.logger.log(
      `Target ${target.url} in route ${routeId} is now ${status} (${change})`
    );

    // Here you could emit events, send notifications, update metrics, etc.
    this.emitHealthChangeEvent(routeId, target, previousHealth);
  }

  /**
   * Emit health change event (placeholder for event system)
   */
  private emitHealthChangeEvent(
    routeId: string,
    target: RouteTarget,
    previousHealth: boolean
  ): void {
    // This could integrate with an event system, metrics collection, etc.
    const event = {
      type: 'target_health_changed',
      routeId,
      targetUrl: target.url,
      previousHealth,
      currentHealth: target.isHealthy,
      timestamp: new Date(),
      errorCount: target.errorCount,
      responseTime: target.responseTime,
    };

    this.logger.debug('Health change event:', event);
  }

  /**
   * Get health status for all targets
   */
  getHealthStatus() {
    const routes = this.routeConfigService.getAllRoutes();
    const healthStatus = {
      timestamp: new Date().toISOString(),
      routes: routes.map(route => ({
        id: route.id,
        path: route.path,
        method: route.method,
        targets: route.targets.map(target => ({
          url: target.url,
          isHealthy: target.isHealthy,
          lastHealthCheck: target.lastHealthCheck,
          responseTime: target.responseTime,
          errorCount: target.errorCount,
        })),
        healthyTargets: route.targets.filter(t => t.isHealthy).length,
        totalTargets: route.targets.length,
      })),
    };

    return healthStatus;
  }

  /**
   * Force health check for a specific route
   */
  async forceHealthCheck(routeId: string): Promise<void> {
    const routes = this.routeConfigService.getAllRoutes();
    const route = routes.find(r => r.id === routeId);
    
    if (!route) {
      throw new Error(`Route not found: ${routeId}`);
    }

    await this.performHealthChecks(routeId, route.loadBalancer.healthCheck, route.targets);
    this.logger.log(`Forced health check completed for route ${routeId}`);
  }

  /**
   * Get health check statistics
   */
  getStats() {
    return {
      activeHealthChecks: this.healthCheckIntervals.size,
      isShuttingDown: this.isShuttingDown,
      healthChecks: Array.from(this.healthCheckIntervals.keys()),
    };
  }
}