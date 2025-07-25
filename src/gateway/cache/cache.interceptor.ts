import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { FastifyRequest, FastifyReply } from 'fastify';
import { CacheService } from './cache.service';

@Injectable()
export class CacheInterceptor implements NestInterceptor {
  private readonly logger = new Logger(CacheInterceptor.name);

  constructor(private readonly cacheService: CacheService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<FastifyRequest>();
    const response = httpContext.getResponse<FastifyReply>();

    // Only cache GET requests
    if (request.method !== 'GET') {
      return next.handle();
    }

    // Skip caching for certain paths
    if (this.shouldSkipCache(request.url)) {
      return next.handle();
    }

    // Generate cache key
    const cacheKey = this.cacheService.generateHttpCacheKey(
      request.method,
      request.url,
      request.headers as Record<string, string>
    );

    // Try to get from cache
    const cachedResponse = this.cacheService.get<any>(cacheKey);
    if (cachedResponse) {
      this.logger.debug(`Cache HIT: ${cacheKey}`);
      
      // Set cache headers
      response.header('X-Cache', 'HIT');
      response.header('X-Cache-Key', this.hashCacheKey(cacheKey));
      
      // Set response data
      response.status(cachedResponse.statusCode || 200);
      
      // Set cached headers
      if (cachedResponse.headers) {
        Object.entries(cachedResponse.headers).forEach(([key, value]) => {
          response.header(key, value as string);
        });
      }

      return of(cachedResponse.body);
    }

    this.logger.debug(`Cache MISS: ${cacheKey}`);
    response.header('X-Cache', 'MISS');
    response.header('X-Cache-Key', this.hashCacheKey(cacheKey));

    // Execute request and cache the response
    return next.handle().pipe(
      tap((responseBody) => {
        this.cacheResponse(cacheKey, request, response, responseBody);
      })
    );
  }

  /**
   * Check if caching should be skipped for this path
   */
  private shouldSkipCache(url: string): boolean {
    const skipPaths = [
      '/health',
      '/metrics',
      '/admin',
      '/api/v1/auth',
    ];

    return skipPaths.some(path => url.startsWith(path));
  }

  /**
   * Cache the response if appropriate
   */
  private cacheResponse(
    cacheKey: string,
    request: FastifyRequest,
    response: FastifyReply,
    responseBody: any
  ): void {
    const statusCode = response.statusCode;
    const headers = this.getResponseHeaders(response);

    // Check if response should be cached
    if (!this.cacheService.shouldCacheResponse(statusCode, headers)) {
      this.logger.debug(`Not caching response: ${cacheKey} (status: ${statusCode})`);
      return;
    }

    // Extract TTL from headers or use default
    const ttl = this.cacheService.extractTTLFromHeaders(headers);

    // Create cache entry
    const cacheEntry = {
      statusCode,
      headers: this.filterResponseHeaders(headers),
      body: responseBody,
      timestamp: Date.now(),
      url: request.url,
      method: request.method,
    };

    // Store in cache
    const cached = this.cacheService.set(cacheKey, cacheEntry, ttl);
    
    if (cached) {
      this.logger.debug(`Cached response: ${cacheKey} (TTL: ${ttl || 'default'}ms)`);
      
      // Add cache headers to response
      response.header('X-Cache-Stored', 'true');
      if (ttl) {
        response.header('Cache-Control', `max-age=${Math.floor(ttl / 1000)}`);
      }
    } else {
      this.logger.warn(`Failed to cache response: ${cacheKey}`);
    }
  }

  /**
   * Get response headers as object
   */
  private getResponseHeaders(response: FastifyReply): Record<string, string> {
    const headers: Record<string, string> = {};
    
    // FastifyReply doesn't have a direct way to get all headers,
    // so we'll rely on what we can access
    const responseHeaders = response.getHeaders();
    
    for (const [key, value] of Object.entries(responseHeaders)) {
      if (typeof value === 'string') {
        headers[key] = value;
      } else if (Array.isArray(value)) {
        headers[key] = value.join(', ');
      } else if (value !== undefined) {
        headers[key] = String(value);
      }
    }

    return headers;
  }

  /**
   * Filter response headers for caching
   */
  private filterResponseHeaders(headers: Record<string, string>): Record<string, string> {
    const filtered: Record<string, string> = {};
    
    // Headers to exclude from caching
    const excludeHeaders = [
      'set-cookie',
      'x-cache',
      'x-cache-key',
      'x-cache-stored',
      'date',
      'server',
      'x-powered-by',
    ];

    for (const [key, value] of Object.entries(headers)) {
      if (!excludeHeaders.includes(key.toLowerCase())) {
        filtered[key] = value;
      }
    }

    return filtered;
  }

  /**
   * Hash cache key for header (for security/privacy)
   */
  private hashCacheKey(key: string): string {
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      const char = key.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).substring(0, 8);
  }
}