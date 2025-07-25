import { z } from 'zod';

// Common validation schemas
export const IdParamSchema = z.object({
  id: z
    .string()
    .uuid('Invalid UUID format'),
});

export const PaginationSchema = z.object({
  page: z
    .string()
    .regex(/^\d+$/, 'Page must be a number')
    .transform(val => parseInt(val, 10))
    .refine(val => val > 0, 'Page must be greater than 0')
    .default('1'),
  
  limit: z
    .string()
    .regex(/^\d+$/, 'Limit must be a number')
    .transform(val => parseInt(val, 10))
    .refine(val => val > 0 && val <= 100, 'Limit must be between 1 and 100')
    .default('10'),
  
  sort: z
    .string()
    .regex(/^[a-zA-Z_]+:(asc|desc)$/, 'Sort format should be field:direction')
    .optional(),
});

export const SearchSchema = z.object({
  q: z
    .string()
    .min(1, 'Search query cannot be empty')
    .max(100, 'Search query must not exceed 100 characters')
    .optional(),
  
  fields: z
    .string()
    .transform(val => val.split(','))
    .pipe(z.array(z.string().min(1)))
    .optional(),
});

export const DateRangeSchema = z.object({
  startDate: z
    .string()
    .datetime('Invalid start date format')
    .optional(),
  
  endDate: z
    .string()
    .datetime('Invalid end date format')
    .optional(),
}).refine(data => {
  if (data.startDate && data.endDate) {
    return new Date(data.startDate) <= new Date(data.endDate);
  }
  return true;
}, {
  message: 'Start date must be before end date',
  path: ['endDate'],
});

// Gateway-specific schemas
export const RouteConfigSchema = z.object({
  path: z
    .string()
    .min(1, 'Path is required')
    .regex(/^\//, 'Path must start with /')
    .max(500, 'Path must not exceed 500 characters'),
  
  target: z
    .string()
    .url('Target must be a valid URL')
    .max(1000, 'Target URL must not exceed 1000 characters'),
  
  method: z
    .enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'])
    .default('GET'),
  
  timeout: z
    .number()
    .min(100, 'Timeout must be at least 100ms')
    .max(300000, 'Timeout must not exceed 5 minutes')
    .default(30000),
  
  retries: z
    .number()
    .min(0, 'Retries must be non-negative')
    .max(5, 'Retries must not exceed 5')
    .default(3),
  
  circuitBreaker: z.object({
    enabled: z.boolean().default(true),
    threshold: z.number().min(1).max(100).default(5),
    timeout: z.number().min(1000).max(300000).default(30000),
  }).optional(),
});

export const RateLimitConfigSchema = z.object({
  ttl: z
    .number()
    .min(1, 'TTL must be at least 1 second')
    .max(3600, 'TTL must not exceed 1 hour')
    .default(60),
  
  limit: z
    .number()
    .min(1, 'Limit must be at least 1')
    .max(10000, 'Limit must not exceed 10,000')
    .default(100),
  
  skipIf: z
    .string()
    .optional(),
});

// Type exports
export type IdParamDto = z.infer<typeof IdParamSchema>;
export type PaginationDto = z.infer<typeof PaginationSchema>;
export type SearchDto = z.infer<typeof SearchSchema>;
export type DateRangeDto = z.infer<typeof DateRangeSchema>;
export type RouteConfigDto = z.infer<typeof RouteConfigSchema>;
export type RateLimitConfigDto = z.infer<typeof RateLimitConfigSchema>;