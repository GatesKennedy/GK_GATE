import { Test, TestingModule } from '@nestjs/testing';
import { RouteConfigService } from './route-config.service';
import { HttpMethod, LoadBalancerAlgorithm } from '../types/route.types';

describe('RouteConfigService', () => {
  let service: RouteConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RouteConfigService],
    }).compile();

    service = module.get<RouteConfigService>(RouteConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getRoute', () => {
    it('should return route configuration for existing route', () => {
      const route = service.getRoute('/api/users', HttpMethod.GET);
      expect(route).toBeDefined();
      expect(route?.path).toBe('/api/users');
      expect(route?.method).toBe(HttpMethod.GET);
    });

    it('should return null for non-existing route', () => {
      const route = service.getRoute('/non-existing', HttpMethod.GET);
      expect(route).toBeNull();
    });
  });

  describe('setRoute', () => {
    it('should create new route configuration', () => {
      const routeConfig = {
        path: '/api/test',
        method: HttpMethod.POST,
        targets: [{
          url: 'http://test-service:3000',
          weight: 1,
          isHealthy: true,
          lastHealthCheck: new Date(),
          responseTime: 0,
          errorCount: 0,
        }],
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
      };

      const createdRoute = service.setRoute(routeConfig);
      
      expect(createdRoute).toBeDefined();
      expect(createdRoute.id).toBeDefined();
      expect(createdRoute.path).toBe('/api/test');
      expect(createdRoute.method).toBe(HttpMethod.POST);
    });
  });

  describe('findMatchingRoute', () => {
    it('should find exact match route', () => {
      const route = service.findMatchingRoute('/api/users', HttpMethod.GET);
      expect(route).toBeDefined();
      expect(route?.path).toBe('/api/users');
    });

    it('should return null for no match', () => {
      const route = service.findMatchingRoute('/no-match', HttpMethod.GET);
      expect(route).toBeNull();
    });
  });

  describe('updateTargetHealth', () => {
    it('should update target health status', () => {
      const route = service.getRoute('/api/users', HttpMethod.GET);
      expect(route).toBeDefined();

      const originalTarget = route?.targets[0];
      expect(originalTarget).toBeDefined();

      service.updateTargetHealth('/api/users', HttpMethod.GET, originalTarget!.url, false);

      const updatedRoute = service.getRoute('/api/users', HttpMethod.GET);
      const updatedTarget = updatedRoute?.targets.find(t => t.url === originalTarget!.url);
      
      expect(updatedTarget?.isHealthy).toBe(false);
    });
  });

  describe('getHealthyTargets', () => {
    it('should return only healthy targets', () => {
      const healthyTargets = service.getHealthyTargets('/api/users', HttpMethod.GET);
      expect(healthyTargets).toBeDefined();
      expect(healthyTargets.every(target => target.isHealthy)).toBe(true);
    });
  });
});