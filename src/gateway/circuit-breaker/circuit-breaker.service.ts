import { Injectable, Logger } from '@nestjs/common';
import { CircuitBreakerConfig } from '../types/route.types';

export enum CircuitBreakerState {
  CLOSED = 'CLOSED',     // Normal operation
  OPEN = 'OPEN',         // Circuit breaker is open, requests fail fast
  HALF_OPEN = 'HALF_OPEN' // Testing if service has recovered
}

export interface CircuitBreakerStats {
  state: CircuitBreakerState;
  failureCount: number;
  successCount: number;
  lastFailureTime: Date | null;
  lastSuccessTime: Date | null;
  nextAttemptTime: Date | null;
  totalRequests: number;
  totalFailures: number;
  totalSuccesses: number;
}

export interface CircuitBreakerInstance {
  id: string;
  config: CircuitBreakerConfig;
  stats: CircuitBreakerStats;
  windowStart: number;
  failureWindow: number[];
}

@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name);
  private circuitBreakers = new Map<string, CircuitBreakerInstance>();

  /**
   * Create or get circuit breaker for a route target
   */
  getCircuitBreaker(routeId: string, targetUrl: string, config: CircuitBreakerConfig): CircuitBreakerInstance {
    const key = this.generateKey(routeId, targetUrl);
    
    if (!this.circuitBreakers.has(key)) {
      this.circuitBreakers.set(key, this.createCircuitBreaker(key, config));
    }

    return this.circuitBreakers.get(key)!;
  }

  /**
   * Check if request should be allowed through circuit breaker
   */
  canExecute(routeId: string, targetUrl: string, config: CircuitBreakerConfig): boolean {
    if (!config.enabled) {
      return true;
    }

    const circuitBreaker = this.getCircuitBreaker(routeId, targetUrl, config);
    const now = Date.now();

    switch (circuitBreaker.stats.state) {
      case CircuitBreakerState.CLOSED:
        return true;

      case CircuitBreakerState.OPEN:
        // Check if enough time has passed to try again
        if (circuitBreaker.stats.nextAttemptTime && now >= circuitBreaker.stats.nextAttemptTime.getTime()) {
          this.transitionToHalfOpen(circuitBreaker);
          return true;
        }
        return false;

      case CircuitBreakerState.HALF_OPEN:
        return true;

      default:
        return false;
    }
  }

  /**
   * Record successful request
   */
  recordSuccess(routeId: string, targetUrl: string, config: CircuitBreakerConfig): void {
    if (!config.enabled) {
      return;
    }

    const circuitBreaker = this.getCircuitBreaker(routeId, targetUrl, config);
    const now = Date.now();

    circuitBreaker.stats.successCount++;
    circuitBreaker.stats.totalSuccesses++;
    circuitBreaker.stats.totalRequests++;
    circuitBreaker.stats.lastSuccessTime = new Date(now);

    // Remove old failures from the sliding window
    this.cleanupWindow(circuitBreaker, now, config.monitorWindow);

    switch (circuitBreaker.stats.state) {
      case CircuitBreakerState.HALF_OPEN:
        // Transition back to closed after successful request in half-open state
        this.transitionToClosed(circuitBreaker);
        break;

      case CircuitBreakerState.OPEN:
        // This shouldn't happen, but reset if it does
        this.transitionToClosed(circuitBreaker);
        break;
    }
  }

  /**
   * Record failed request
   */
  recordFailure(routeId: string, targetUrl: string, config: CircuitBreakerConfig): void {
    if (!config.enabled) {
      return;
    }

    const circuitBreaker = this.getCircuitBreaker(routeId, targetUrl, config);
    const now = Date.now();

    circuitBreaker.stats.failureCount++;
    circuitBreaker.stats.totalFailures++;
    circuitBreaker.stats.totalRequests++;
    circuitBreaker.stats.lastFailureTime = new Date(now);
    circuitBreaker.failureWindow.push(now);

    // Clean up old failures
    this.cleanupWindow(circuitBreaker, now, config.monitorWindow);

    // Check if we should open the circuit breaker
    if (circuitBreaker.failureWindow.length >= config.threshold) {
      this.transitionToOpen(circuitBreaker, config);
    }
  }

  /**
   * Get circuit breaker statistics for a target
   */
  getStats(routeId: string, targetUrl: string): CircuitBreakerStats | null {
    const key = this.generateKey(routeId, targetUrl);
    const circuitBreaker = this.circuitBreakers.get(key);
    
    return circuitBreaker ? { ...circuitBreaker.stats } : null;
  }

  /**
   * Get all circuit breaker statistics
   */
  getAllStats(): Record<string, CircuitBreakerStats> {
    const stats: Record<string, CircuitBreakerStats> = {};
    
    for (const [key, circuitBreaker] of this.circuitBreakers.entries()) {
      stats[key] = { ...circuitBreaker.stats };
    }

    return stats;
  }

  /**
   * Reset circuit breaker for a target
   */
  reset(routeId: string, targetUrl: string): boolean {
    const key = this.generateKey(routeId, targetUrl);
    const circuitBreaker = this.circuitBreakers.get(key);
    
    if (circuitBreaker) {
      this.transitionToClosed(circuitBreaker);
      this.logger.log(`Circuit breaker reset for ${key}`);
      return true;
    }

    return false;
  }

  /**
   * Reset all circuit breakers
   */
  resetAll(): number {
    let resetCount = 0;
    
    for (const [_key, circuitBreaker] of this.circuitBreakers.entries()) {
      this.transitionToClosed(circuitBreaker);
      resetCount++;
    }

    this.logger.log(`Reset ${resetCount} circuit breakers`);
    return resetCount;
  }

  /**
   * Create new circuit breaker instance
   */
  private createCircuitBreaker(id: string, config: CircuitBreakerConfig): CircuitBreakerInstance {
    const now = Date.now();
    
    return {
      id,
      config,
      stats: {
        state: CircuitBreakerState.CLOSED,
        failureCount: 0,
        successCount: 0,
        lastFailureTime: null,
        lastSuccessTime: null,
        nextAttemptTime: null,
        totalRequests: 0,
        totalFailures: 0,
        totalSuccesses: 0,
      },
      windowStart: now,
      failureWindow: [],
    };
  }

  /**
   * Transition circuit breaker to CLOSED state
   */
  private transitionToClosed(circuitBreaker: CircuitBreakerInstance): void {
    if (circuitBreaker.stats.state !== CircuitBreakerState.CLOSED) {
      this.logger.log(`Circuit breaker ${circuitBreaker.id} transitioned to CLOSED`);
    }

    circuitBreaker.stats.state = CircuitBreakerState.CLOSED;
    circuitBreaker.stats.failureCount = 0;
    circuitBreaker.stats.nextAttemptTime = null;
    circuitBreaker.failureWindow = [];
  }

  /**
   * Transition circuit breaker to OPEN state
   */
  private transitionToOpen(circuitBreaker: CircuitBreakerInstance, config: CircuitBreakerConfig): void {
    const now = Date.now();
    
    this.logger.warn(
      `Circuit breaker ${circuitBreaker.id} OPENED after ${circuitBreaker.failureWindow.length} failures`
    );

    circuitBreaker.stats.state = CircuitBreakerState.OPEN;
    circuitBreaker.stats.nextAttemptTime = new Date(now + config.timeout);
  }

  /**
   * Transition circuit breaker to HALF_OPEN state
   */
  private transitionToHalfOpen(circuitBreaker: CircuitBreakerInstance): void {
    this.logger.log(`Circuit breaker ${circuitBreaker.id} transitioned to HALF_OPEN`);
    
    circuitBreaker.stats.state = CircuitBreakerState.HALF_OPEN;
    circuitBreaker.stats.nextAttemptTime = null;
  }

  /**
   * Clean up old entries from the failure window
   */
  private cleanupWindow(circuitBreaker: CircuitBreakerInstance, now: number, windowSize: number): void {
    const cutoffTime = now - windowSize;
    circuitBreaker.failureWindow = circuitBreaker.failureWindow.filter(time => time > cutoffTime);
  }

  /**
   * Generate unique key for circuit breaker
   */
  private generateKey(routeId: string, targetUrl: string): string {
    return `${routeId}:${targetUrl}`;
  }

  /**
   * Get fallback response for circuit breaker
   */
  getFallbackResponse(config: CircuitBreakerConfig) {
    return config.fallbackResponse || {
      message: 'Service temporarily unavailable',
      statusCode: 503,
      error: 'Circuit breaker is OPEN',
      retryAfter: Math.ceil(config.timeout / 1000),
    };
  }

  /**
   * Cleanup expired circuit breakers
   */
  cleanup(): number {
    const now = Date.now();
    const maxIdleTime = 300000; // 5 minutes
    let cleanedCount = 0;

    for (const [key, circuitBreaker] of this.circuitBreakers.entries()) {
      const lastActivity = Math.max(
        circuitBreaker.stats.lastSuccessTime?.getTime() || 0,
        circuitBreaker.stats.lastFailureTime?.getTime() || 0
      );

      if (now - lastActivity > maxIdleTime) {
        this.circuitBreakers.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.debug(`Cleaned up ${cleanedCount} idle circuit breakers`);
    }

    return cleanedCount;
  }
}