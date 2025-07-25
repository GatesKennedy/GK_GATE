export interface RouteTarget {
  url: string;
  weight: number;
  isHealthy: boolean;
  lastHealthCheck: Date;
  responseTime: number;
  errorCount: number;
}

export interface RouteConfig {
  id: string;
  path: string;
  method: HttpMethod;
  targets: RouteTarget[];
  loadBalancer: LoadBalancerConfig;
  circuitBreaker: CircuitBreakerConfig;
  rateLimit?: RateLimitConfig;
  timeout: number;
  retries: number;
  headers?: Record<string, string>;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface LoadBalancerConfig {
  algorithm: LoadBalancerAlgorithm;
  healthCheck: HealthCheckConfig;
  stickySession?: StickySessionConfig;
}

export interface CircuitBreakerConfig {
  enabled: boolean;
  threshold: number;
  timeout: number;
  monitorWindow: number;
  fallbackResponse?: any;
}

export interface RateLimitConfig {
  ttl: number;
  limit: number;
  keyGenerator?: string;
  skipIf?: string;
}

export interface HealthCheckConfig {
  enabled: boolean;
  path: string;
  interval: number;
  timeout: number;
  healthyThreshold: number;
  unhealthyThreshold: number;
}

export interface StickySessionConfig {
  enabled: boolean;
  cookieName: string;
  cookieTtl: number;
}

export enum HttpMethod {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  DELETE = 'DELETE',
  PATCH = 'PATCH',
  HEAD = 'HEAD',
  OPTIONS = 'OPTIONS',
}

export enum LoadBalancerAlgorithm {
  ROUND_ROBIN = 'round-robin',
  WEIGHTED_ROUND_ROBIN = 'weighted-round-robin',
  LEAST_CONNECTIONS = 'least-connections',
  LEAST_RESPONSE_TIME = 'least-response-time',
  HEALTH_BASED = 'health-based',
  RANDOM = 'random',
}

export interface ProxyRequest {
  method: HttpMethod;
  path: string;
  headers: Record<string, string>;
  body?: any;
  query: Record<string, string>;
  params: Record<string, string>;
  userId?: string;
  traceId: string;
  timestamp: Date;
}

export interface ProxyResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: any;
  responseTime: number;
  targetUrl: string;
  traceId: string;
  timestamp: Date;
}