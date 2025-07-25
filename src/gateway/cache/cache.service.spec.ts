import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CacheService } from './cache.service';

describe('CacheService', () => {
  let service: CacheService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              const config = {
                'gateway.cache.maxSize': 100,
                'gateway.cache.maxMemory': 1024 * 1024, // 1MB
                'gateway.cache.ttl': 5000, // 5 seconds
              };
              return config[key as keyof typeof config] || defaultValue;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<CacheService>(CacheService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('basic cache operations', () => {
    it('should set and get values', () => {
      const key = 'test-key';
      const value = { data: 'test-data' };

      const setResult = service.set(key, value);
      expect(setResult).toBe(true);

      const getValue = service.get(key);
      expect(getValue).toEqual(value);
    });

    it('should return null for non-existent keys', () => {
      const getValue = service.get('non-existent');
      expect(getValue).toBeNull();
    });

    it('should check if key exists', () => {
      const key = 'test-key';
      const value = 'test-value';

      expect(service.has(key)).toBe(false);
      
      service.set(key, value);
      expect(service.has(key)).toBe(true);
    });

    it('should delete values', () => {
      const key = 'test-key';
      const value = 'test-value';

      service.set(key, value);
      expect(service.has(key)).toBe(true);

      const deleted = service.delete(key);
      expect(deleted).toBe(true);
      expect(service.has(key)).toBe(false);
    });

    it('should clear all values', () => {
      service.set('key1', 'value1');
      service.set('key2', 'value2');

      service.clear();

      expect(service.has('key1')).toBe(false);
      expect(service.has('key2')).toBe(false);
    });
  });

  describe('TTL functionality', () => {
    it('should respect custom TTL', async () => {
      const key = 'ttl-test';
      const value = 'test-value';
      const shortTTL = 100; // 100ms

      service.set(key, value, shortTTL);
      expect(service.get(key)).toBe(value);

      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(service.get(key)).toBeNull();
    });

    it('should use default TTL when not specified', () => {
      const key = 'default-ttl';
      const value = 'test-value';

      service.set(key, value);
      expect(service.get(key)).toBe(value);
    });
  });

  describe('getOrSet functionality', () => {
    it('should return cached value if exists', async () => {
      const key = 'cached-key';
      const cachedValue = 'cached-value';
      const callbackValue = 'callback-value';

      service.set(key, cachedValue);

      const callback = jest.fn().mockResolvedValue(callbackValue);
      const result = await service.getOrSet(key, callback);

      expect(result).toBe(cachedValue);
      expect(callback).not.toHaveBeenCalled();
    });

    it('should call callback and cache result if key does not exist', async () => {
      const key = 'new-key';
      const callbackValue = 'callback-value';

      const callback = jest.fn().mockResolvedValue(callbackValue);
      const result = await service.getOrSet(key, callback);

      expect(result).toBe(callbackValue);
      expect(callback).toHaveBeenCalledTimes(1);
      expect(service.get(key)).toBe(callbackValue);
    });
  });

  describe('HTTP cache functionality', () => {
    it('should generate cache keys for HTTP requests', () => {
      const key1 = service.generateHttpCacheKey('GET', '/api/users');
      const key2 = service.generateHttpCacheKey('POST', '/api/users');
      const key3 = service.generateHttpCacheKey('GET', '/api/orders');

      expect(key1).toBe('http:GET:/api/users');
      expect(key2).toBe('http:POST:/api/users');
      expect(key3).toBe('http:GET:/api/orders');
      expect(key1).not.toBe(key2);
      expect(key1).not.toBe(key3);
    });

    it('should include user info in cache key when present', () => {
      const headers = { authorization: 'Bearer token123' };
      const key = service.generateHttpCacheKey('GET', '/api/profile', headers);
      
      expect(key).toContain('http:GET:/api/profile:user:');
      expect(key.length).toBeGreaterThan('http:GET:/api/profile'.length);
    });

    it('should determine if responses should be cached', () => {
      // Should cache successful responses
      expect(service.shouldCacheResponse(200, {})).toBe(true);
      expect(service.shouldCacheResponse(201, {})).toBe(true);

      // Should not cache error responses
      expect(service.shouldCacheResponse(400, {})).toBe(false);
      expect(service.shouldCacheResponse(500, {})).toBe(false);

      // Should not cache when cache-control says no
      expect(service.shouldCacheResponse(200, { 'cache-control': 'no-cache' })).toBe(false);
      expect(service.shouldCacheResponse(200, { 'cache-control': 'no-store' })).toBe(false);

      // Should not cache responses with cookies
      expect(service.shouldCacheResponse(200, { 'set-cookie': 'session=abc123' })).toBe(false);
    });

    it('should extract TTL from cache headers', () => {
      // Test max-age extraction
      const maxAgeTTL = service.extractTTLFromHeaders({ 'cache-control': 'max-age=300' });
      expect(maxAgeTTL).toBe(300000); // 300 seconds in milliseconds

      // Test expires header
      const futureDate = new Date(Date.now() + 60000).toISOString(); // 1 minute from now
      const expiresTTL = service.extractTTLFromHeaders({ 'expires': futureDate });
      expect(expiresTTL).toBeGreaterThan(50000); // Should be close to 60000ms

      // Test no cache headers
      const noTTL = service.extractTTLFromHeaders({});
      expect(noTTL).toBeUndefined();
    });
  });

  describe('statistics', () => {
    it('should track cache statistics', () => {
      // Initial stats
      let stats = service.getStats();
      expect(stats.totalEntries).toBe(0);
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);

      // Add some data
      service.set('key1', 'value1');
      service.set('key2', 'value2');

      // Access data (hits and misses)
      service.get('key1'); // hit
      service.get('key1'); // hit
      service.get('nonexistent'); // miss

      stats = service.getStats();
      expect(stats.totalEntries).toBe(2);
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe(2/3);
    });
  });
});