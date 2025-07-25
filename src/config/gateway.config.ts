import { registerAs } from '@nestjs/config';

export default registerAs('gateway', () => ({
  circuitBreaker: {
    threshold: parseInt(process.env.CIRCUIT_BREAKER_THRESHOLD || '5', 10),
    timeout: parseInt(process.env.CIRCUIT_BREAKER_TIMEOUT || '30000', 10),
    monitorInterval: parseInt(process.env.CIRCUIT_BREAKER_MONITOR || '60000', 10),
    fallbackEnabled: process.env.CIRCUIT_BREAKER_FALLBACK === 'true',
  },
  loadBalancer: {
    algorithm: process.env.LOAD_BALANCER_ALGORITHM || 'round-robin',
    healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL || '30000', 10),
    healthCheckTimeout: parseInt(process.env.HEALTH_CHECK_TIMEOUT || '5000', 10),
  },
  cache: {
    ttl: parseInt(process.env.CACHE_TTL || '300', 10),
    maxSize: parseInt(process.env.CACHE_MAX_SIZE || '1000', 10),
  },
  timeout: {
    default: parseInt(process.env.REQUEST_TIMEOUT || '30000', 10),
    connection: parseInt(process.env.CONNECTION_TIMEOUT || '5000', 10),
  },
}));