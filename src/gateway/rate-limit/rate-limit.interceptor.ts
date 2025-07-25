import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { FastifyRequest, FastifyReply } from 'fastify';
import { AdvancedRateLimitService, RateLimitRule } from './advanced-rate-limit.service';

@Injectable()
export class RateLimitInterceptor implements NestInterceptor {
  private readonly logger = new Logger(RateLimitInterceptor.name);

  constructor(
    private readonly rateLimitService: AdvancedRateLimitService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<FastifyRequest>();
    const response = httpContext.getResponse<FastifyReply>();

    // Skip rate limiting for certain paths
    if (this.shouldSkipRateLimit(request.url)) {
      return next.handle();
    }

    // Get rate limit rules for this request
    const rules = this.getRateLimitRules(request);
    
    // Check rate limit
    const rateLimitResult = this.rateLimitService.checkRateLimit(request, rules);

    // Add rate limit headers
    this.addRateLimitHeaders(response, rateLimitResult);

    // If rate limit exceeded, return error
    if (!rateLimitResult.allowed) {
      this.logger.warn(
        `Rate limit exceeded for ${this.getClientIdentifier(request)}: ${request.method} ${request.url}`
      );

      response.status(HttpStatus.TOO_MANY_REQUESTS).send({
        message: 'Too Many Requests',
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        error: 'Rate limit exceeded',
        retryAfter: rateLimitResult.retryAfter,
      });

      return new Observable(subscriber => subscriber.complete());
    }

    return next.handle().pipe(
      tap(() => {
        // Log successful request with rate limit info
        this.logger.debug(
          `Request allowed: ${request.method} ${request.url} ` +
          `(${rateLimitResult.totalHits}/${rateLimitResult.totalHits + rateLimitResult.remainingHits})`
        );
      })
    );
  }

  /**
   * Check if rate limiting should be skipped for this path
   */
  private shouldSkipRateLimit(url: string): boolean {
    const skipPaths = [
      '/health',
      '/metrics',
      '/favicon.ico',
    ];

    return skipPaths.some(path => url.startsWith(path));
  }

  /**
   * Get rate limit rules for the current request
   */
  private getRateLimitRules(_request: FastifyRequest): RateLimitRule[] {
    // Base rules for all requests
    const baseRules = this.rateLimitService.createRules({
      global: { limit: 1000, window: 60000 }, // 1000 requests per minute globally
      perIP: { limit: 100, window: 60000 },   // 100 requests per minute per IP
      perUser: { limit: 200, window: 60000 }, // 200 requests per minute per user
    });

    // Endpoint-specific rules
    const endpointRules = this.rateLimitService.createEndpointRules({
      '/api/v1/auth/login': { limit: 5, window: 300000 },     // 5 login attempts per 5 minutes
      '/api/v1/auth/register': { limit: 3, window: 300000 },  // 3 registration attempts per 5 minutes
      '/api/users': { limit: 50, window: 60000 },             // 50 requests per minute to users API
      '/api/orders': { limit: 30, window: 60000 },            // 30 requests per minute to orders API
    });

    return [...baseRules, ...endpointRules];
  }

  /**
   * Add rate limit headers to response
   */
  private addRateLimitHeaders(response: FastifyReply, result: any): void {
    response.header('X-RateLimit-Limit', (result.totalHits + result.remainingHits).toString());
    response.header('X-RateLimit-Remaining', result.remainingHits.toString());
    response.header('X-RateLimit-Reset', new Date(result.resetTime).toISOString());
    
    if (result.retryAfter) {
      response.header('Retry-After', result.retryAfter.toString());
    }
  }

  /**
   * Get client identifier for logging
   */
  private getClientIdentifier(request: FastifyRequest): string {
    const user = (request as any).user;
    const ip = this.getClientIp(request);
    
    if (user) {
      return `user:${user.username} (${ip})`;
    }
    
    return `ip:${ip}`;
  }

  /**
   * Get client IP address
   */
  private getClientIp(request: FastifyRequest): string {
    const xForwardedFor = request.headers['x-forwarded-for'];
    if (xForwardedFor) {
      const ips = Array.isArray(xForwardedFor) 
        ? xForwardedFor[0] 
        : xForwardedFor;
      return ips?.split(',')[0]?.trim() || 'unknown';
    }

    return request.ip || 'unknown';
  }
}