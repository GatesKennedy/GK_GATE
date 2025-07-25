import { Injectable, Logger, BadGatewayException, RequestTimeoutException } from '@nestjs/common';
import { RouteTarget, ProxyRequest, ProxyResponse } from '../types/route.types';

@Injectable()
export class ProxyService {
  private readonly logger = new Logger(ProxyService.name);

  /**
   * Forward request to target service
   */
  async forwardRequest(
    request: ProxyRequest,
    target: RouteTarget,
    timeout: number = 30000,
    retries: number = 3
  ): Promise<ProxyResponse> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await this.makeRequest(request, target, timeout);
        
        // Log successful request
        this.logger.debug(
          `Request forwarded successfully: ${request.method} ${request.path} -> ${target.url} (${response.responseTime}ms)`
        );

        return response;
      } catch (error) {
        lastError = error as Error;
        
        this.logger.warn(
          `Request attempt ${attempt}/${retries} failed: ${request.method} ${request.path} -> ${target.url}`,
          error
        );

        // Don't retry on client errors (4xx)
        if (error instanceof BadGatewayException && attempt < retries) {
          const delay = this.calculateRetryDelay(attempt);
          await this.sleep(delay);
          continue;
        }

        // Throw immediately for non-retryable errors
        if (attempt === retries) {
          throw error;
        }
      }
    }

    // This shouldn't be reached, but TypeScript needs it
    throw lastError || new BadGatewayException('All retry attempts failed');
  }

  /**
   * Make HTTP request using native fetch
   */
  private async makeRequest(
    request: ProxyRequest,
    target: RouteTarget,
    timeout: number
  ): Promise<ProxyResponse> {
    const startTime = Date.now();
    const targetUrl = this.buildTargetUrl(target.url, request.path, request.query);

    // Create fetch options
    const fetchOptions: RequestInit = {
      method: request.method,
      headers: this.prepareHeaders(request.headers),
      signal: AbortSignal.timeout(timeout),
    };

    // Add body for non-GET requests
    if (request.body && !['GET', 'HEAD'].includes(request.method)) {
      if (typeof request.body === 'object') {
        fetchOptions.body = JSON.stringify(request.body);
        fetchOptions.headers = {
          ...fetchOptions.headers,
          'Content-Type': 'application/json',
        };
      } else {
        fetchOptions.body = request.body;
      }
    }

    try {
      const response = await fetch(targetUrl, fetchOptions);
      const responseTime = Date.now() - startTime;

      // Read response body
      let body: any;
      const contentType = response.headers.get('content-type') || '';
      
      if (contentType.includes('application/json')) {
        try {
          body = await response.json();
        } catch {
          // If JSON parsing fails, treat as text
          body = await response.text();
        }
      } else {
        body = await response.text();
      }

      // Convert response headers to object
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      const proxyResponse: ProxyResponse = {
        statusCode: response.status,
        headers: responseHeaders,
        body,
        responseTime,
        targetUrl,
        traceId: request.traceId,
        timestamp: new Date(),
      };

      // Throw error for HTTP error status codes
      if (!response.ok) {
        this.logger.warn(
          `Target returned error status: ${response.status} for ${request.method} ${targetUrl}`
        );
        
        if (response.status >= 500) {
          throw new BadGatewayException(`Target service error: ${response.status}`);
        }
      }

      return proxyResponse;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'TimeoutError') {
        throw new RequestTimeoutException(
          `Request timeout after ${timeout}ms to ${targetUrl}`
        );
      }

      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new BadGatewayException(
          `Failed to connect to target service: ${targetUrl}`
        );
      }

      // Re-throw other errors
      throw error;
    }
  }

  /**
   * Build target URL with path and query parameters
   */
  private buildTargetUrl(baseUrl: string, path: string, query: Record<string, string>): string {
    // Remove leading slash from path if baseUrl already has one
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    const url = new URL(cleanPath, baseUrl);

    // Add query parameters
    Object.entries(query).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });

    return url.toString();
  }

  /**
   * Prepare headers for forwarding
   */
  private prepareHeaders(headers: Record<string, string>): Record<string, string> {
    const forwardedHeaders = { ...headers };

    // Remove hop-by-hop headers
    const hopByHopHeaders = [
      'connection',
      'keep-alive',
      'proxy-authenticate',
      'proxy-authorization',
      'te',
      'trailers',
      'transfer-encoding',
      'upgrade',
    ];

    hopByHopHeaders.forEach(header => {
      delete forwardedHeaders[header];
      delete forwardedHeaders[header.toLowerCase()];
    });

    // Add forwarding headers
    forwardedHeaders['X-Forwarded-By'] = 'nestjs-api-gateway';
    forwardedHeaders['X-Forwarded-At'] = new Date().toISOString();

    // Set User-Agent if not present
    if (!forwardedHeaders['user-agent'] && !forwardedHeaders['User-Agent']) {
      forwardedHeaders['User-Agent'] = 'NestJS-API-Gateway/1.0.0';
    }

    return forwardedHeaders;
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateRetryDelay(attempt: number): number {
    const baseDelay = 1000; // 1 second
    const maxDelay = 10000; // 10 seconds
    const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
    
    // Add jitter to avoid thundering herd
    const jitter = Math.random() * 0.1 * delay;
    return delay + jitter;
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Health check a target
   */
  async healthCheck(
    target: RouteTarget,
    healthPath: string = '/health',
    timeout: number = 5000
  ): Promise<boolean> {
    try {
      const healthUrl = new URL(healthPath, target.url).toString();
      const response = await fetch(healthUrl, {
        method: 'GET',
        signal: AbortSignal.timeout(timeout),
        headers: {
          'User-Agent': 'NestJS-API-Gateway-HealthCheck/1.0.0',
        },
      });

      return response.ok;
    } catch (error) {
      this.logger.warn(`Health check failed for ${target.url}:`, error);
      return false;
    }
  }

  /**
   * Get proxy service statistics
   */
  getStats() {
    return {
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    };
  }
}