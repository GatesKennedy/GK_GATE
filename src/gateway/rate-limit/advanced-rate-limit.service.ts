import { Injectable, Logger } from '@nestjs/common';
import { FastifyRequest } from 'fastify';

export interface RateLimitWindow {
  count: number;
  resetTime: number;
  firstRequest: number;
}

export interface RateLimitResult {
  allowed: boolean;
  totalHits: number;
  remainingHits: number;
  resetTime: number;
  retryAfter?: number;
}

export interface RateLimitRule {
  key: string;
  limit: number;
  window: number; // in milliseconds
  skipIf?: (request: FastifyRequest) => boolean;
}

@Injectable()
export class AdvancedRateLimitService {
  private readonly logger = new Logger(AdvancedRateLimitService.name);
  private windows = new Map<string, RateLimitWindow>();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Cleanup expired windows every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredWindows();
    }, 60000);
  }

  onModuleDestroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }

  /**
   * Check if request is allowed based on rate limit rules
   */
  checkRateLimit(request: FastifyRequest, rules: RateLimitRule[]): RateLimitResult {
    const now = Date.now();
    let mostRestrictive: RateLimitResult = {
      allowed: true,
      totalHits: 0,
      remainingHits: Infinity,
      resetTime: now,
    };

    for (const rule of rules) {
      // Skip rule if condition is met
      if (rule.skipIf && rule.skipIf(request)) {
        continue;
      }

      const key = this.generateKey(request, rule.key);
      const result = this.checkSingleRule(key, rule, now);

      // If any rule denies the request, deny it
      if (!result.allowed) {
        return result;
      }

      // Keep track of the most restrictive rule
      if (result.remainingHits < mostRestrictive.remainingHits) {
        mostRestrictive = result;
      }
    }

    return mostRestrictive;
  }

  /**
   * Check a single rate limit rule
   */
  private checkSingleRule(key: string, rule: RateLimitRule, now: number): RateLimitResult {
    let window = this.windows.get(key);

    // Create new window if doesn't exist or expired
    if (!window || now >= window.resetTime) {
      window = {
        count: 0,
        resetTime: now + rule.window,
        firstRequest: now,
      };
      this.windows.set(key, window);
    }

    // Check if limit exceeded
    if (window.count >= rule.limit) {
      return {
        allowed: false,
        totalHits: window.count,
        remainingHits: 0,
        resetTime: window.resetTime,
        retryAfter: Math.ceil((window.resetTime - now) / 1000),
      };
    }

    // Increment counter
    window.count++;

    return {
      allowed: true,
      totalHits: window.count,
      remainingHits: rule.limit - window.count,
      resetTime: window.resetTime,
    };
  }

  /**
   * Generate rate limit key based on request and key pattern
   */
  private generateKey(request: FastifyRequest, keyPattern: string): string {
    const replacements: Record<string, () => string> = {
      '{ip}': () => this.getClientIp(request),
      '{user}': () => (request as any).user?.sub || 'anonymous',
      '{path}': () => request.url.split('?')[0] || '/',
      '{method}': () => request.method,
      '{user-agent}': () => request.headers['user-agent'] || 'unknown',
    };

    let key = keyPattern;
    for (const [pattern, getValue] of Object.entries(replacements)) {
      key = key.replace(new RegExp(pattern.replace(/[{}]/g, '\\$&'), 'g'), getValue());
    }

    return key;
  }

  /**
   * Get client IP address from request
   */
  private getClientIp(request: FastifyRequest): string {
    // Check X-Forwarded-For header first (for proxies)
    const xForwardedFor = request.headers['x-forwarded-for'];
    if (xForwardedFor) {
      const ips = Array.isArray(xForwardedFor) 
        ? xForwardedFor[0] 
        : xForwardedFor;
      return ips?.split(',')[0]?.trim() || 'unknown';
    }

    // Check X-Real-IP header
    const xRealIp = request.headers['x-real-ip'];
    if (xRealIp && typeof xRealIp === 'string') {
      return xRealIp;
    }

    // Fall back to connection remote address
    return request.ip || 'unknown';
  }

  /**
   * Create common rate limit rules
   */
  createRules(config: {
    global?: { limit: number; window: number };
    perUser?: { limit: number; window: number };
    perIP?: { limit: number; window: number };
    perEndpoint?: { limit: number; window: number };
  }): RateLimitRule[] {
    const rules: RateLimitRule[] = [];

    if (config.global) {
      rules.push({
        key: 'global',
        limit: config.global.limit,
        window: config.global.window,
      });
    }

    if (config.perUser) {
      rules.push({
        key: 'user:{user}',
        limit: config.perUser.limit,
        window: config.perUser.window,
        skipIf: (request) => !(request as any).user, // Skip for unauthenticated requests
      });
    }

    if (config.perIP) {
      rules.push({
        key: 'ip:{ip}',
        limit: config.perIP.limit,
        window: config.perIP.window,
      });
    }

    if (config.perEndpoint) {
      rules.push({
        key: 'endpoint:{method}:{path}',
        limit: config.perEndpoint.limit,
        window: config.perEndpoint.window,
      });
    }

    return rules;
  }

  /**
   * Create endpoint-specific rate limit rules
   */
  createEndpointRules(endpointRules: Record<string, { limit: number; window: number }>): RateLimitRule[] {
    return Object.entries(endpointRules).map(([endpoint, config]) => ({
      key: `endpoint:${endpoint}`,
      limit: config.limit,
      window: config.window,
      skipIf: (request) => !request.url.startsWith(endpoint),
    }));
  }

  /**
   * Clean up expired rate limit windows
   */
  private cleanupExpiredWindows(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, window] of this.windows.entries()) {
      if (now >= window.resetTime) {
        this.windows.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.debug(`Cleaned up ${cleanedCount} expired rate limit windows`);
    }
  }

  /**
   * Get rate limit statistics
   */
  getStats() {
    const now = Date.now();
    const activeWindows = Array.from(this.windows.entries()).map(([key, window]) => ({
      key,
      count: window.count,
      resetTime: window.resetTime,
      timeRemaining: Math.max(0, window.resetTime - now),
      isExpired: now >= window.resetTime,
    }));

    return {
      totalWindows: this.windows.size,
      activeWindows: activeWindows.filter(w => !w.isExpired).length,
      expiredWindows: activeWindows.filter(w => w.isExpired).length,
      windows: activeWindows,
    };
  }

  /**
   * Reset rate limit for a specific key
   */
  resetRateLimit(key: string): boolean {
    return this.windows.delete(key);
  }

  /**
   * Reset all rate limits
   */
  resetAllRateLimits(): void {
    const count = this.windows.size;
    this.windows.clear();
    this.logger.log(`Reset ${count} rate limit windows`);
  }
}