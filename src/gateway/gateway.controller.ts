import {
  Controller,
  All,
  Req,
  Res,
  HttpStatus,
  Logger,
  BadGatewayException,
  NotFoundException,
} from '@nestjs/common';
import { FastifyRequest, FastifyReply } from 'fastify';
import { Public, CurrentUser } from '../auth/decorators';
import { RouteConfigService } from './routing/route-config.service';
import { LoadBalancerService } from './load-balancer/load-balancer.service';
import { ProxyService } from './routing/proxy.service';
import { HttpMethod, ProxyRequest } from './types/route.types';

@Controller('*')
export class GatewayController {
  private readonly logger = new Logger(GatewayController.name);

  constructor(
    private readonly routeConfigService: RouteConfigService,
    private readonly loadBalancerService: LoadBalancerService,
    private readonly proxyService: ProxyService,
  ) {}

  @Public()
  @All()
  async handleRequest(
    @Req() request: FastifyRequest,
    @Res() response: FastifyReply,
    @CurrentUser() user?: any,
  ) {
    const startTime = Date.now();
    const traceId = (request.headers['x-trace-id'] as string) || this.generateTraceId();
    
    try {
      // Skip auth and health endpoints - let them be handled by their controllers
      if (this.shouldSkipGateway(request.url)) {
        return response.status(404).send({ message: 'Not Found' });
      }

      // Find matching route configuration
      const route = this.routeConfigService.findMatchingRoute(
        request.url,
        request.method.toUpperCase() as HttpMethod
      );

      if (!route) {
        this.logger.warn(`No route configuration found for: ${request.method} ${request.url}`);
        throw new NotFoundException(`Route not found: ${request.method} ${request.url}`);
      }

      // Get healthy targets
      const healthyTargets = this.routeConfigService.getHealthyTargets(
        route.path,
        route.method
      );

      if (healthyTargets.length === 0) {
        this.logger.error(`No healthy targets available for route: ${route.path}`);
        throw new BadGatewayException('No healthy backend services available');
      }

      // Select target using load balancer
      const routeKey = `${route.method}:${route.path}`;
      const selectedTarget = this.loadBalancerService.selectTarget(
        healthyTargets,
        route.loadBalancer.algorithm,
        routeKey,
        user?.sub
      );

      if (!selectedTarget) {
        throw new BadGatewayException('Unable to select backend target');
      }

      // Increment connection count
      this.loadBalancerService.incrementConnectionCount(selectedTarget.url);

      try {
        // Prepare proxy request
        const proxyRequest: ProxyRequest = {
          method: request.method.toUpperCase() as HttpMethod,
          path: request.url.split('?')[0] || '/',
          headers: this.extractHeaders(request),
          body: request.body,
          query: request.query as Record<string, string>,
          params: request.params as Record<string, string>,
          userId: user?.sub,
          traceId,
          timestamp: new Date(),
        };

        // Forward request to selected target
        const proxyResponse = await this.proxyService.forwardRequest(
          proxyRequest,
          selectedTarget,
          route.timeout,
          route.retries
        );

        // Update target response time
        this.routeConfigService.updateTargetResponseTime(
          route.path,
          route.method,
          selectedTarget.url,
          proxyResponse.responseTime
        );

        // Set response headers
        Object.entries(proxyResponse.headers).forEach(([key, value]) => {
          // Skip headers that should not be forwarded
          if (!this.shouldSkipHeader(key)) {
            response.header(key, value);
          }
        });

        // Add gateway headers
        response.header('X-Gateway-Target', selectedTarget.url);
        response.header('X-Gateway-Response-Time', proxyResponse.responseTime.toString());
        response.header('X-Trace-Id', traceId);
        response.header('X-Gateway-Route', route.path);

        // Log successful request
        const totalTime = Date.now() - startTime;
        this.logger.log(
          `Request completed: ${request.method} ${request.url} -> ${selectedTarget.url} ` +
          `(${proxyResponse.statusCode}, ${totalTime}ms)`
        );

        // Send response
        return response.status(proxyResponse.statusCode).send(proxyResponse.body);

      } finally {
        // Decrement connection count
        this.loadBalancerService.decrementConnectionCount(selectedTarget.url);
      }

    } catch (error) {
      const totalTime = Date.now() - startTime;
      
      this.logger.error(
        `Request failed: ${request.method} ${request.url} (${totalTime}ms)`,
        error
      );

      // Set error trace header
      response.header('X-Trace-Id', traceId);

      if (error instanceof NotFoundException) {
        return response.status(HttpStatus.NOT_FOUND).send({
          message: error.message,
          statusCode: HttpStatus.NOT_FOUND,
          traceId,
        });
      }

      if (error instanceof BadGatewayException) {
        return response.status(HttpStatus.BAD_GATEWAY).send({
          message: error.message,
          statusCode: HttpStatus.BAD_GATEWAY,
          traceId,
        });
      }

      // Generic error response
      return response.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
        message: 'Internal server error',
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        traceId,
      });
    }
  }

  /**
   * Check if request should skip gateway routing
   */
  private shouldSkipGateway(url: string): boolean {
    const skipPaths = [
      '/health',
      '/api/v1/auth',
      '/metrics',
      '/favicon.ico',
    ];

    return skipPaths.some(path => url.startsWith(path));
  }

  /**
   * Extract headers from request
   */
  private extractHeaders(request: FastifyRequest): Record<string, string> {
    const headers: Record<string, string> = {};
    
    Object.entries(request.headers).forEach(([key, value]) => {
      if (typeof value === 'string') {
        headers[key] = value;
      } else if (Array.isArray(value)) {
        headers[key] = value.join(', ');
      }
    });

    return headers;
  }

  /**
   * Check if header should be skipped when forwarding response
   */
  private shouldSkipHeader(headerName: string): boolean {
    const skipHeaders = [
      'transfer-encoding',
      'connection',
      'keep-alive',
      'proxy-authenticate',
      'proxy-authorization',
      'te',
      'trailers',
      'upgrade',
    ];

    return skipHeaders.includes(headerName.toLowerCase());
  }

  /**
   * Generate trace ID for request tracking
   */
  private generateTraceId(): string {
    return `gw_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  }
}