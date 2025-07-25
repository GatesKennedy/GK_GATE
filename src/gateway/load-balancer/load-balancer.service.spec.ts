import { Test, TestingModule } from '@nestjs/testing';
import { LoadBalancerService } from './load-balancer.service';
import { LoadBalancerAlgorithm, RouteTarget } from '../types/route.types';

describe('LoadBalancerService', () => {
  let service: LoadBalancerService;

  const mockTargets: RouteTarget[] = [
    {
      url: 'http://service1:3000',
      weight: 1,
      isHealthy: true,
      lastHealthCheck: new Date(),
      responseTime: 100,
      errorCount: 0,
    },
    {
      url: 'http://service2:3000',
      weight: 2,
      isHealthy: true,
      lastHealthCheck: new Date(),
      responseTime: 150,
      errorCount: 1,
    },
    {
      url: 'http://service3:3000',
      weight: 1,
      isHealthy: false,
      lastHealthCheck: new Date(),
      responseTime: 200,
      errorCount: 5,
    },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LoadBalancerService],
    }).compile();

    service = module.get<LoadBalancerService>(LoadBalancerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('selectTarget', () => {
    it('should return null when no healthy targets available', () => {
      const unhealthyTargets = mockTargets.map(t => ({ ...t, isHealthy: false }));
      const result = service.selectTarget(
        unhealthyTargets,
        LoadBalancerAlgorithm.ROUND_ROBIN,
        'test-route'
      );
      expect(result).toBeNull();
    });

    it('should select target using round-robin algorithm', () => {
      const healthyTargets = mockTargets.filter(t => t.isHealthy);
      
      const result1 = service.selectTarget(
        healthyTargets,
        LoadBalancerAlgorithm.ROUND_ROBIN,
        'test-route'
      );
      const result2 = service.selectTarget(
        healthyTargets,
        LoadBalancerAlgorithm.ROUND_ROBIN,
        'test-route'
      );

      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
      expect(result1?.url).not.toBe(result2?.url);
    });

    it('should select target using least response time algorithm', () => {
      const healthyTargets = mockTargets.filter(t => t.isHealthy);
      
      const result = service.selectTarget(
        healthyTargets,
        LoadBalancerAlgorithm.LEAST_RESPONSE_TIME,
        'test-route'
      );

      expect(result).toBeDefined();
      expect(result?.responseTime).toBe(100); // Should select the fastest
    });

    it('should select target using health-based algorithm', () => {
      const healthyTargets = mockTargets.filter(t => t.isHealthy);
      
      const result = service.selectTarget(
        healthyTargets,
        LoadBalancerAlgorithm.HEALTH_BASED,
        'test-route'
      );

      expect(result).toBeDefined();
      expect(result?.errorCount).toBe(0); // Should select the healthiest
    });
  });

  describe('connection tracking', () => {
    it('should track connection counts', () => {
      const targetUrl = 'http://test:3000';
      
      expect(service.getConnectionCount(targetUrl)).toBe(0);
      
      service.incrementConnectionCount(targetUrl);
      expect(service.getConnectionCount(targetUrl)).toBe(1);
      
      service.incrementConnectionCount(targetUrl);
      expect(service.getConnectionCount(targetUrl)).toBe(2);
      
      service.decrementConnectionCount(targetUrl);
      expect(service.getConnectionCount(targetUrl)).toBe(1);
    });

    it('should not go below zero when decrementing', () => {
      const targetUrl = 'http://test:3000';
      
      service.decrementConnectionCount(targetUrl);
      expect(service.getConnectionCount(targetUrl)).toBe(0);
    });
  });

  describe('statistics', () => {
    it('should return load balancer statistics', () => {
      const stats = service.getStats();
      
      expect(stats).toBeDefined();
      expect(stats.roundRobinCounters).toBeDefined();
      expect(stats.connectionCounts).toBeDefined();
      expect(stats.totalRoutes).toBeDefined();
      expect(stats.totalConnections).toBeDefined();
    });

    it('should reset statistics', () => {
      // Add some data
      service.selectTarget(mockTargets.filter(t => t.isHealthy), LoadBalancerAlgorithm.ROUND_ROBIN, 'test');
      service.incrementConnectionCount('http://test:3000');
      
      service.resetStats();
      
      const stats = service.getStats();
      expect(stats.totalRoutes).toBe(0);
      expect(stats.totalConnections).toBe(0);
    });
  });
});