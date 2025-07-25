import { Test, TestingModule } from '@nestjs/testing';
import { CircuitBreakerService, CircuitBreakerState } from './circuit-breaker.service';

describe('CircuitBreakerService', () => {
  let service: CircuitBreakerService;

  const mockConfig = {
    enabled: true,
    threshold: 3,
    timeout: 5000,
    monitorWindow: 10000,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CircuitBreakerService],
    }).compile();

    service = module.get<CircuitBreakerService>(CircuitBreakerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('circuit breaker flow', () => {
    const routeId = 'test-route';
    const targetUrl = 'http://test-service:3000';

    it('should start in closed state', () => {
      const canExecute = service.canExecute(routeId, targetUrl, mockConfig);
      expect(canExecute).toBe(true);

      const stats = service.getStats(routeId, targetUrl);
      expect(stats?.state).toBe(CircuitBreakerState.CLOSED);
    });

    it('should record successful requests', () => {
      service.recordSuccess(routeId, targetUrl, mockConfig);
      
      const stats = service.getStats(routeId, targetUrl);
      expect(stats?.successCount).toBe(1);
      expect(stats?.totalSuccesses).toBe(1);
      expect(stats?.totalRequests).toBe(1);
    });

    it('should record failed requests', () => {
      service.recordFailure(routeId, targetUrl, mockConfig);
      
      const stats = service.getStats(routeId, targetUrl);
      expect(stats?.failureCount).toBe(1);
      expect(stats?.totalFailures).toBe(1);
      expect(stats?.totalRequests).toBe(1);
    });

    it('should open circuit breaker after threshold failures', () => {
      // Record threshold number of failures
      for (let i = 0; i < mockConfig.threshold; i++) {
        service.recordFailure(routeId, targetUrl, mockConfig);
      }

      const stats = service.getStats(routeId, targetUrl);
      expect(stats?.state).toBe(CircuitBreakerState.OPEN);
      
      // Should not allow execution when open
      const canExecute = service.canExecute(routeId, targetUrl, mockConfig);
      expect(canExecute).toBe(false);
    });

    it('should transition to half-open after timeout', () => {
      // First open the circuit breaker
      for (let i = 0; i < mockConfig.threshold; i++) {
        service.recordFailure(routeId, targetUrl, mockConfig);
      }

      // Mock that timeout has passed
      const circuitBreaker = service.getCircuitBreaker(routeId, targetUrl, mockConfig);
      circuitBreaker.stats.nextAttemptTime = new Date(Date.now() - 1000); // 1 second ago

      const canExecute = service.canExecute(routeId, targetUrl, mockConfig);
      expect(canExecute).toBe(true);

      const stats = service.getStats(routeId, targetUrl);
      expect(stats?.state).toBe(CircuitBreakerState.HALF_OPEN);
    });

    it('should close circuit breaker on success in half-open state', () => {
      // Open the circuit breaker
      for (let i = 0; i < mockConfig.threshold; i++) {
        service.recordFailure(routeId, targetUrl, mockConfig);
      }

      // Transition to half-open
      const circuitBreaker = service.getCircuitBreaker(routeId, targetUrl, mockConfig);
      circuitBreaker.stats.nextAttemptTime = new Date(Date.now() - 1000);
      service.canExecute(routeId, targetUrl, mockConfig);

      // Record success
      service.recordSuccess(routeId, targetUrl, mockConfig);

      const stats = service.getStats(routeId, targetUrl);
      expect(stats?.state).toBe(CircuitBreakerState.CLOSED);
    });
  });

  describe('management operations', () => {
    it('should reset specific circuit breaker', () => {
      const routeId = 'test-route';
      const targetUrl = 'http://test-service:3000';

      // Create some failures
      service.recordFailure(routeId, targetUrl, mockConfig);
      service.recordFailure(routeId, targetUrl, mockConfig);

      const resetResult = service.reset(routeId, targetUrl);
      expect(resetResult).toBe(true);

      const stats = service.getStats(routeId, targetUrl);
      expect(stats?.state).toBe(CircuitBreakerState.CLOSED);
      expect(stats?.failureCount).toBe(0);
    });

    it('should reset all circuit breakers', () => {
      // Create multiple circuit breakers with failures
      service.recordFailure('route1', 'url1', mockConfig);
      service.recordFailure('route2', 'url2', mockConfig);

      const resetCount = service.resetAll();
      expect(resetCount).toBe(2);

      const allStats = service.getAllStats();
      for (const stats of Object.values(allStats)) {
        expect(stats.state).toBe(CircuitBreakerState.CLOSED);
      }
    });

    it('should return fallback response', () => {
      const configWithFallback = {
        ...mockConfig,
        fallbackResponse: { message: 'Service unavailable', code: 503 },
      };

      const fallback = service.getFallbackResponse(configWithFallback);
      expect(fallback).toEqual({ message: 'Service unavailable', code: 503 });
    });
  });

  describe('disabled circuit breaker', () => {
    const disabledConfig = { ...mockConfig, enabled: false };
    const routeId = 'test-route';
    const targetUrl = 'http://test-service:3000';

    it('should always allow execution when disabled', () => {
      const canExecute = service.canExecute(routeId, targetUrl, disabledConfig);
      expect(canExecute).toBe(true);
    });

    it('should not record failures when disabled', () => {
      service.recordFailure(routeId, targetUrl, disabledConfig);
      
      // Should not create circuit breaker entry
      const stats = service.getStats(routeId, targetUrl);
      expect(stats).toBeNull();
    });
  });
});