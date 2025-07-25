import { Injectable, Logger } from '@nestjs/common';
import { RouteConfig, RouteTarget, HttpMethod, LoadBalancerAlgorithm } from '../types/route.types';

@Injectable()
export class RouteConfigService {
  private readonly logger = new Logger(RouteConfigService.name);
  private routes = new Map<string, RouteConfig>();

  constructor() {
    this.initializeDefaultRoutes();
  }

  /**
   * Get route configuration by path and method
   */
  getRoute(path: string, method: HttpMethod): RouteConfig | null {
    const routeKey = this.generateRouteKey(path, method);
    return this.routes.get(routeKey) || null;
  }

  /**
   * Get all active routes
   */
  getAllRoutes(): RouteConfig[] {
    return Array.from(this.routes.values()).filter(route => route.isActive);
  }

  /**
   * Add or update a route configuration
   */
  setRoute(config: Omit<RouteConfig, 'id' | 'createdAt' | 'updatedAt'>): RouteConfig {
    const routeId = crypto.randomUUID();
    const now = new Date();
    
    const route: RouteConfig = {
      ...config,
      id: routeId,
      createdAt: now,
      updatedAt: now,
    };

    const routeKey = this.generateRouteKey(config.path, config.method);
    this.routes.set(routeKey, route);

    this.logger.log(`Route configured: ${config.method} ${config.path} -> ${config.targets.length} targets`);
    return route;
  }

  /**
   * Remove a route configuration
   */
  removeRoute(path: string, method: HttpMethod): boolean {
    const routeKey = this.generateRouteKey(path, method);
    const deleted = this.routes.delete(routeKey);
    
    if (deleted) {
      this.logger.log(`Route removed: ${method} ${path}`);
    }
    
    return deleted;
  }

  /**
   * Update route target health status
   */
  updateTargetHealth(path: string, method: HttpMethod, targetUrl: string, isHealthy: boolean): void {
    const route = this.getRoute(path, method);
    if (!route) return;

    const target = route.targets.find(t => t.url === targetUrl);
    if (target) {
      target.isHealthy = isHealthy;
      target.lastHealthCheck = new Date();
      
      if (!isHealthy) {
        target.errorCount++;
      }
    }
  }

  /**
   * Update target response time
   */
  updateTargetResponseTime(path: string, method: HttpMethod, targetUrl: string, responseTime: number): void {
    const route = this.getRoute(path, method);
    if (!route) return;

    const target = route.targets.find(t => t.url === targetUrl);
    if (target) {
      target.responseTime = responseTime;
    }
  }

  /**
   * Get healthy targets for a route
   */
  getHealthyTargets(path: string, method: HttpMethod): RouteTarget[] {
    const route = this.getRoute(path, method);
    if (!route) return [];

    return route.targets.filter(target => target.isHealthy);
  }

  /**
   * Find matching route by path pattern
   */
  findMatchingRoute(requestPath: string, method: HttpMethod): RouteConfig | null {
    // First try exact match
    const exactMatch = this.getRoute(requestPath, method);
    if (exactMatch) return exactMatch;

    // Then try pattern matching
    for (const route of this.routes.values()) {
      if (route.method === method && route.isActive) {
        if (this.pathMatches(route.path, requestPath)) {
          return route;
        }
      }
    }

    return null;
  }

  /**
   * Check if request path matches route pattern
   */
  private pathMatches(routePath: string, requestPath: string): boolean {
    // Convert route pattern to regex
    const pattern = routePath
      .replace(/:[^/]+/g, '([^/]+)')  // :param -> ([^/]+)
      .replace(/\*/g, '.*');          // * -> .*

    const regex = new RegExp(`^${pattern}$`);
    return regex.test(requestPath);
  }

  /**
   * Generate unique key for route
   */
  private generateRouteKey(path: string, method: HttpMethod): string {
    return `${method}:${path}`;
  }

  /**
   * Initialize default routes for demonstration
   */
  private initializeDefaultRoutes(): void {
    // Example route configurations
    this.setRoute({
      path: '/api/users',
      method: HttpMethod.GET,
      targets: [
        {
          url: 'http://user-service:3001/users',
          weight: 1,
          isHealthy: true,
          lastHealthCheck: new Date(),
          responseTime: 0,
          errorCount: 0,
        },
        {
          url: 'http://user-service-backup:3001/users',
          weight: 1,
          isHealthy: true,
          lastHealthCheck: new Date(),
          responseTime: 0,
          errorCount: 0,
        },
      ],
      loadBalancer: {
        algorithm: LoadBalancerAlgorithm.ROUND_ROBIN,
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
        enabled: true,
        threshold: 5,
        timeout: 30000,
        monitorWindow: 60000,
      },
      timeout: 30000,
      retries: 3,
      isActive: true,
    });

    this.setRoute({
      path: '/api/orders',
      method: HttpMethod.GET,
      targets: [
        {
          url: 'http://order-service:3002/orders',
          weight: 2,
          isHealthy: true,
          lastHealthCheck: new Date(),
          responseTime: 0,
          errorCount: 0,
        },
        {
          url: 'http://order-service-v2:3002/orders',
          weight: 1,
          isHealthy: true,
          lastHealthCheck: new Date(),
          responseTime: 0,
          errorCount: 0,
        },
      ],
      loadBalancer: {
        algorithm: LoadBalancerAlgorithm.WEIGHTED_ROUND_ROBIN,
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
        enabled: true,
        threshold: 5,
        timeout: 30000,
        monitorWindow: 60000,
      },
      timeout: 30000,
      retries: 3,
      isActive: true,
    });

    this.logger.log(`Initialized ${this.routes.size} default routes`);
  }
}