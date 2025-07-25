import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface CacheEntry<T = any> {
  key: string;
  value: T;
  expiresAt: number;
  createdAt: number;
  accessCount: number;
  lastAccessed: number;
  size: number; // Approximate size in bytes
}

export interface CacheStats {
  totalEntries: number;
  totalSize: number;
  hits: number;
  misses: number;
  hitRate: number;
  evictions: number;
  averageAge: number;
  oldestEntry: number;
  newestEntry: number;
}

export interface CacheConfig {
  maxSize: number;        // Maximum number of entries
  maxMemory: number;      // Maximum memory usage in bytes
  defaultTTL: number;     // Default TTL in milliseconds
  cleanupInterval: number; // Cleanup interval in milliseconds
}

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private cache = new Map<string, CacheEntry>();
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
  };
  private cleanupInterval: NodeJS.Timeout;

  private readonly config: CacheConfig;

  constructor(private readonly configService: ConfigService) {
    this.config = {
      maxSize: this.configService.get('gateway.cache.maxSize', 1000),
      maxMemory: this.configService.get('gateway.cache.maxMemory', 50 * 1024 * 1024), // 50MB
      defaultTTL: this.configService.get('gateway.cache.ttl', 300000), // 5 minutes
      cleanupInterval: 60000, // 1 minute
    };

    // Start periodic cleanup
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);

    this.logger.log(`Cache initialized with maxSize: ${this.config.maxSize}, maxMemory: ${this.config.maxMemory} bytes`);
  }

  onModuleDestroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }

  /**
   * Get value from cache
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check if expired
    if (Date.now() >= entry.expiresAt) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    // Update access statistics
    entry.accessCount++;
    entry.lastAccessed = Date.now();
    this.stats.hits++;

    return entry.value as T;
  }

  /**
   * Set value in cache
   */
  set<T>(key: string, value: T, ttl?: number): boolean {
    const now = Date.now();
    const expiration = ttl || this.config.defaultTTL;
    const size = this.estimateSize(value);

    // Check if we need to make space
    if (this.shouldEvict(size)) {
      this.evictEntries(size);
    }

    const entry: CacheEntry<T> = {
      key,
      value,
      expiresAt: now + expiration,
      createdAt: now,
      accessCount: 0,
      lastAccessed: now,
      size,
    };

    this.cache.set(key, entry);
    
    this.logger.debug(`Cache SET: ${key} (size: ${size} bytes, TTL: ${expiration}ms)`);
    return true;
  }

  /**
   * Delete value from cache
   */
  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.logger.debug(`Cache DELETE: ${key}`);
    }
    return deleted;
  }

  /**
   * Check if key exists in cache
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }

    // Check if expired
    if (Date.now() >= entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Get or set value with callback
   */
  async getOrSet<T>(
    key: string, 
    callback: () => Promise<T>, 
    ttl?: number
  ): Promise<T> {
    const cached = this.get<T>(key);
    
    if (cached !== null) {
      return cached;
    }

    // Generate new value
    const value = await callback();
    this.set(key, value, ttl);
    
    return value;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    this.logger.log(`Cache cleared (${size} entries removed)`);
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const now = Date.now();
    const entries = Array.from(this.cache.values());
    const totalRequests = this.stats.hits + this.stats.misses;
    
    let totalSize = 0;
    let totalAge = 0;
    let oldestEntry = now;
    let newestEntry = 0;

    for (const entry of entries) {
      totalSize += entry.size;
      totalAge += now - entry.createdAt;
      oldestEntry = Math.min(oldestEntry, entry.createdAt);
      newestEntry = Math.max(newestEntry, entry.createdAt);
    }

    return {
      totalEntries: this.cache.size,
      totalSize,
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: totalRequests > 0 ? this.stats.hits / totalRequests : 0,
      evictions: this.stats.evictions,
      averageAge: entries.length > 0 ? totalAge / entries.length : 0,
      oldestEntry: entries.length > 0 ? now - oldestEntry : 0,
      newestEntry: entries.length > 0 ? now - newestEntry : 0,
    };
  }

  /**
   * Generate cache key for HTTP requests
   */
  generateHttpCacheKey(method: string, url: string, headers?: Record<string, string>): string {
    const baseKey = `http:${method}:${url}`;
    
    if (headers && (headers['authorization'] || headers['x-user-id'])) {
      // Include user identifier for personalized responses
      const userHash = this.hashString(headers['authorization'] || headers['x-user-id'] || '');
      return `${baseKey}:user:${userHash}`;
    }

    return baseKey;
  }

  /**
   * Check if response should be cached
   */
  shouldCacheResponse(statusCode: number, headers: Record<string, string>): boolean {
    // Don't cache error responses
    if (statusCode >= 400) {
      return false;
    }

    // Don't cache if cache-control says no
    const cacheControl = headers['cache-control'] || '';
    if (cacheControl.includes('no-cache') || cacheControl.includes('no-store')) {
      return false;
    }

    // Don't cache responses with set-cookie headers
    if (headers['set-cookie']) {
      return false;
    }

    return true;
  }

  /**
   * Extract TTL from cache headers
   */
  extractTTLFromHeaders(headers: Record<string, string>): number | undefined {
    const cacheControl = headers['cache-control'] || '';
    const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
    
    if (maxAgeMatch && maxAgeMatch[1]) {
      return parseInt(maxAgeMatch[1], 10) * 1000; // Convert to milliseconds
    }

    // Check Expires header
    const expires = headers['expires'];
    if (expires && typeof expires === 'string') {
      const expiresTime = new Date(expires).getTime();
      const now = Date.now();
      if (expiresTime > now) {
        return expiresTime - now;
      }
    }

    return undefined;
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let expiredCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now >= entry.expiresAt) {
        this.cache.delete(key);
        expiredCount++;
      }
    }

    if (expiredCount > 0) {
      this.logger.debug(`Cache cleanup: removed ${expiredCount} expired entries`);
    }
  }

  /**
   * Check if we should evict entries to make space
   */
  private shouldEvict(newEntrySize: number): boolean {
    if (this.cache.size >= this.config.maxSize) {
      return true;
    }

    const currentSize = this.getCurrentMemoryUsage();
    return (currentSize + newEntrySize) > this.config.maxMemory;
  }

  /**
   * Evict entries using LRU policy
   */
  private evictEntries(spaceNeeded: number): void {
    const entries = Array.from(this.cache.entries())
      .map(([key, entry]) => ({ key, entry }))
      .sort((a, b) => a.entry.lastAccessed - b.entry.lastAccessed); // Least recently used first

    let spaceFreed = 0;
    let evicted = 0;

    for (const { key, entry } of entries) {
      if (spaceFreed >= spaceNeeded && this.cache.size < this.config.maxSize) {
        break;
      }

      this.cache.delete(key);
      spaceFreed += entry.size;
      evicted++;
    }

    this.stats.evictions += evicted;
    this.logger.debug(`Cache eviction: removed ${evicted} entries, freed ${spaceFreed} bytes`);
  }

  /**
   * Get current memory usage
   */
  private getCurrentMemoryUsage(): number {
    let totalSize = 0;
    for (const entry of this.cache.values()) {
      totalSize += entry.size;
    }
    return totalSize;
  }

  /**
   * Estimate size of value in bytes
   */
  private estimateSize(value: any): number {
    if (value === null || value === undefined) {
      return 0;
    }

    if (typeof value === 'string') {
      return value.length * 2; // UTF-16 encoding
    }

    if (typeof value === 'number') {
      return 8; // 64-bit number
    }

    if (typeof value === 'boolean') {
      return 1;
    }

    // For objects, use JSON.stringify length as approximation
    return JSON.stringify(value).length * 2;
  }

  /**
   * Simple hash function for strings
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }
}