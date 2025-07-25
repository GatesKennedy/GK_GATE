THIS FILE IS NOT TO BE EDITE WITHOUT EXPLICIT CONSENT WITH PASSWORD=updateContextPlz

# CONTEXT.md - Additional Project Context

This file provides supplementary context and implementation details for the NestJS API Gateway project that complement the main CLAUDE.md file.

## Architecture Patterns Implementation

### Gateway Aggregation Pattern

The gateway implements response aggregation to combine multiple backend service calls into unified client responses.

**Implementation Approach**:

```typescript
// Example aggregation service
@Injectable()
export class AggregationService {
	async aggregateUserData(userId: string): Promise<UserAggregateDto> {
		const [profile, preferences, activity] = await Promise.allSettled([
			this.userService.getProfile(userId),
			this.preferenceService.getPreferences(userId),
			this.activityService.getRecentActivity(userId),
		]);

		return this.combineResults(profile, preferences, activity);
	}
}
```

### Backend for Frontend (BFF) Pattern

Separate routing logic for different client types (mobile, web, admin) with tailored data formats.

**Directory Structure**:

```
src/gateway/bff/
├── mobile/           # Mobile-optimized endpoints
├── web/              # Web client endpoints
├── admin/            # Admin dashboard endpoints
└── shared/           # Common BFF utilities
```

### Strangler Fig Pattern

Gradual migration support from legacy systems to microservices with intelligent routing.

**Migration Configuration**:

```typescript
@Injectable()
export class MigrationRoutingService {
	private migrationConfig = {
		'/api/users': { legacy: false, rollout: 100 },
		'/api/orders': { legacy: true, rollout: 25 },
		'/api/payments': { legacy: false, rollout: 100 },
	};
}
```

## Security Architecture Deep Dive

### Zero Trust Implementation

Every request undergoes complete authentication and authorization regardless of source.

**Security Layers**:

1. **Network Level**: TLS termination and validation
2. **Application Level**: JWT validation and RBAC
3. **Service Level**: Service-to-service authentication
4. **Data Level**: Field-level access control

### Token Management Strategy

```typescript
// Custom token validation with enhanced security
@Injectable()
export class TokenValidationService {
	async validateToken(token: string): Promise<TokenPayload> {
		// 1. Verify JWT signature and expiration
		// 2. Check token blacklist/revocation
		// 3. Validate token scopes and permissions
		// 4. Rate limit token usage
		// 5. Audit token access patterns
	}
}
```

### Rate Limiting Configuration

```typescript
// Multi-tier rate limiting strategy
export const rateLimitConfig = {
	global: { ttl: 60, limit: 1000 }, // Global requests per minute
	perUser: { ttl: 60, limit: 100 }, // Per user per minute
	perEndpoint: {
		// Endpoint-specific limits
		'/api/auth/login': { ttl: 300, limit: 5 },
		'/api/search': { ttl: 60, limit: 50 },
		'/api/upload': { ttl: 3600, limit: 10 },
	},
};
```

## Performance Optimization Details

### Connection Pool Configuration

```typescript
// Optimized connection pooling for backend services
export const connectionPoolConfig = {
	maxSockets: 100,
	maxFreeSockets: 10,
	timeout: 30000,
	freeSocketTimeout: 15000,
	keepAlive: true,
	keepAliveMsecs: 1000,
};
```

### Caching Strategy Implementation

```typescript
// Multi-level caching with intelligent TTL
@Injectable()
export class CacheService {
	private readonly cacheConfig = {
		L1: { ttl: 60, size: 1000 }, // In-memory cache
		L2: { ttl: 300, size: 10000 }, // Redis cache
		L3: { ttl: 3600 }, // CDN cache
	};
}
```

### Circuit Breaker Configuration

```typescript
// Resilience pattern implementation
export const circuitBreakerConfig = {
	threshold: 5, // Failure threshold
	timeout: 30000, // Recovery timeout
	monitor: 60000, // Monitoring interval
	fallback: true, // Enable fallback responses
	healthCheck: '/health', // Health check endpoint
};
```

## Monitoring & Observability Implementation

### Distributed Tracing Setup

```typescript
// Request correlation and tracing
@Injectable()
export class TracingService {
	generateTraceId(): string {
		return `trace_${Date.now()}_${Math.random().toString(36)}`;
	}

	addTraceHeaders(request: Request, response: Response) {
		const traceId = request.headers['x-trace-id'] || this.generateTraceId();
		response.setHeader('x-trace-id', traceId);
		return traceId;
	}
}
```

### Custom Metrics Collection

```typescript
// Business and technical metrics
@Injectable()
export class MetricsService {
	private metrics = {
		requests: new Counter('gateway_requests_total'),
		duration: new Histogram('gateway_request_duration_seconds'),
		errors: new Counter('gateway_errors_total'),
		circuitBreaker: new Gauge('gateway_circuit_breaker_state'),
	};
}
```

### Health Check Implementation

```typescript
// Comprehensive health monitoring
@Injectable()
export class HealthService {
	@Get('/health')
	async healthCheck(): Promise<HealthCheckResult> {
		return {
			status: 'ok',
			timestamp: new Date().toISOString(),
			services: await this.checkServices(),
			resources: await this.checkResources(),
			version: process.env.APP_VERSION,
		};
	}
}
```

## Development Workflow Integration

### Pre-commit Hook Configuration

```yaml
# .pre-commit-config.yaml
repos:
    - repo: local
      hooks:
          - id: typescript-check
            name: TypeScript Check
            entry: npx tsc --noEmit
            language: system
            files: \.(ts|tsx)$

          - id: zod-validation-check
            name: Zod Schema Validation
            entry: npm run validate:schemas
            language: system
            files: \.schema\.ts$

          - id: security-scan
            name: Security Scan
            entry: npm run security:scan
            language: system
            always_run: true
```

## Development Workflow with Makefile Automation

### Minimalist Command Structure

The project uses a **Makefile-based approach** instead of complex npm scripts, maintaining the 2025 optimization principle of simplicity.

**Package.json Scripts (4 essentials only)**:

```json
{
	"scripts": {
		"build": "nest build",
		"start": "node dist/main",
		"dev": "tsx src/main.ts",
		"test": "jest"
	}
}
```

**Makefile Extensions**:

```makefile
# Core workflows
make dev              # Development server
make build            # Production build
make test             # Run tests
make validate         # TypeCheck + test

# Extended operations
make docker-build     # Container build
make k8s-deploy       # Kubernetes deployment
make health           # Health check
make fresh-start      # Clean install + dev
```

### Development Commands

```bash
# Start development
make dev

# Run with watch mode
make dev-watch

# Debug mode
make dev-debug

# Type checking
make typecheck

# All validation
make validate
```

### No Complex npm Scripts

The optimization eliminates script bloat by:

-   **4 essential npm scripts only**
-   **Makefile handles variations** and combinations
-   **Direct tool usage** where appropriate
-   **Clear separation** between core and extended commands

### Testing Strategy with Minimal Dependencies

```typescript
// Pure Jest + Supertest testing (no additional test utilities)
describe('Gateway API', () => {
	let app: INestApplication;

	beforeAll(async () => {
		const moduleFixture: TestingModule = await Test.createTestingModule({
			imports: [AppModule],
		}).compile();

		app = moduleFixture.createNestApplication(new FastifyAdapter());
		await app.init();
		await app.getHttpAdapter().getInstance().ready();
	});

	it('/health (GET)', () => {
		return request(app.getHttpServer())
			.get('/health')
			.expect(200)
			.expect((res) => {
				expect(res.body.status).toBe('ok');
			});
	});
});
```

## Deployment & Infrastructure

### Docker Multi-stage Optimization

```dockerfile
# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force
COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine AS production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs
WORKDIR /app
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/package.json ./package.json
USER nestjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1
CMD ["node", "dist/main.js"]
```

### Kubernetes Deployment Configuration

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
    name: nestjs-api-gateway
spec:
    replicas: 3
    selector:
        matchLabels:
            app: nestjs-api-gateway
    template:
        metadata:
            labels:
                app: nestjs-api-gateway
        spec:
            containers:
                - name: api-gateway
                  image: nestjs-api-gateway:latest
                  ports:
                      - containerPort: 3000
                  env:
                      - name: NODE_ENV
                        value: 'production'
                  resources:
                      requests:
                          memory: '256Mi'
                          cpu: '250m'
                      limits:
                          memory: '512Mi'
                          cpu: '500m'
                  livenessProbe:
                      httpGet:
                          path: /health
                          port: 3000
                      initialDelaySeconds: 30
                      periodSeconds: 10
                  readinessProbe:
                      httpGet:
                          path: /health/ready
                          port: 3000
                      initialDelaySeconds: 5
                      periodSeconds: 5
```

## Final Optimized Dependency Structure

The streamlined package.json achieves the **73% dependency reduction** mentioned in the optimization guide:

**Before Optimization**: 30+ typical NestJS dependencies
**After Optimization**: 19 total dependencies (11 production + 8 development)

### Production Dependencies (11 packages)

```json
{
	"@nestjs/core": "^11.1.5",
	"@nestjs/common": "^11.1.5",
	"@nestjs/platform-fastify": "^11.1.5",
	"fastify": "^4.x",
	"@nestjs/config": "^4.0.2",
	"@nestjs/jwt": "^10.2.0",
	"@nestjs/throttler": "^6.4.0",
	"argon2": "^0.40.1",
	"helmet": "^8.1.0",
	"zod": "^3.x",
	"reflect-metadata": "^0.1.14"
}
```

### Development Dependencies (8 packages)

```json
{
	"@nestjs/cli": "^10.0.0",
	"@nestjs/testing": "^10.0.0",
	"typescript": "^5.0.0",
	"tsx": "^4.0.0",
	"jest": "^29.0.0",
	"supertest": "^6.0.0",
	"@types/node": "^20.0.0",
	"@types/supertest": "^6.0.0"
}
```

### Packages Explicitly Removed (11 packages)

-   axios, @nestjs/axios
-   @nestjs/passport, passport, passport-jwt
-   bcrypt
-   class-validator, class-transformer
-   http-proxy-middleware
-   ts-node
-   @types/passport-jwt

### Net Result

-   **11 packages removed**, **3 packages added**
-   **73% reduction** in security/validation dependencies
-   **Minimal attack surface** with essential-only dependencies
-   **Maximum performance** through optimized stack

## Performance Benchmarks & Targets

### Expected Improvements

-   **Throughput**: 17,000 RPS → 50,000+ RPS (194% improvement)
-   **Memory Usage**: 15-20% reduction in containers
-   **Bundle Size**: 60-70% dependency reduction
-   **Cold Start**: 20-30% faster initialization

### Monitoring Thresholds

```typescript
export const performanceThresholds = {
	responseTime: {
		p95: 100, // 95th percentile under 100ms
		p99: 250, // 99th percentile under 250ms
	},
	errorRate: 0.1, // Less than 0.1% error rate
	availability: 99.9, // 99.9% uptime target
	throughput: 50000, // 50k RPS capacity
};
```

This context provides the detailed implementation guidance needed to build a production-ready, optimized API Gateway following 2025 best practices.
