import { registerAs } from '@nestjs/config';

export default registerAs('security', () => ({
  jwt: {
    secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  argon2: {
    timeCost: parseInt(process.env.ARGON2_TIME_COST || '2', 10),
    memoryCost: parseInt(process.env.ARGON2_MEMORY_COST || '65536', 10),
    parallelism: parseInt(process.env.ARGON2_PARALLELISM || '1', 10),
  },
  rateLimit: {
    ttl: parseInt(process.env.RATE_LIMIT_TTL || '60', 10),
    limit: parseInt(process.env.RATE_LIMIT_MAX || '1000', 10),
    perUser: {
      ttl: parseInt(process.env.RATE_LIMIT_PER_USER_TTL || '60', 10),
      limit: parseInt(process.env.RATE_LIMIT_PER_USER_MAX || '100', 10),
    },
  },
}));