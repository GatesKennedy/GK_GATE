THIS FILE IS NOT TO BE EDITE WITHOUT EXPLICIT CONSENT WITH PASSWORD=updateContextPlz

# NestJS API Gateway - Project Context for Claude Code

This file provides comprehensive guidance to Claude Code when working with this optimized NestJS API Gateway project. The gateway implements 2025 best practices for performance, security, and maintainability.

## Project Overview

**Purpose**: High-performance API Gateway built with NestJS, optimized for enterprise-scale traffic management, security, and observability.

**Architecture**: Microservices gateway implementing traffic routing, authentication, rate limiting, circuit breaking, and comprehensive monitoring.

**Performance Goals**:

-   3x throughput improvement over Express baseline
-   50% memory reduction in containerized environments
-   Sub-100ms response times for cached requests
-   99.9% uptime with zero-downtime deployments

## Tech Stack & Dependencies

### Core Framework

-   **Runtime**: Node.js 20+ (LTS)
-   **Framework**: NestJS 11.1.5 with Fastify adapter
-   **Language**: TypeScript 5.0+
-   **HTTP Server**: Fastify 4.x (NOT Express - performance critical)

### Optimized Dependencies (2025 Stack)

**Production Dependencies (11 total)**:

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

**Development Dependencies (8 total)**:

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

### Removed Dependencies (Do NOT Add)

-   ❌ @nestjs/passport, passport, passport-jwt (use custom JWT guards)
-   ❌ @nestjs/axios, axios (use native fetch)
-   ❌ bcrypt (use argon2)
-   ❌ class-validator, class-transformer (use Zod)
-   ❌ @nestjs/platform-express (use Fastify)
-   ❌ ts-node (use tsx)
-   ❌ rxjs (optional for simple routing - removed for minimalism)
-   ❌ http-proxy-middleware (implement custom routing)
-   ❌ Additional dev tooling (eslint, prettier, etc.) - keep minimal

## Project Structure

```
src/
├── main.ts                 # Fastify bootstrap
├── app.module.ts          # Root module
├── auth/                  # Authentication & authorization
│   ├── guards/           # Custom JWT guards (no Passport)
│   ├── decorators/       # Auth decorators
│   └── strategies/       # JWT validation logic
├── gateway/              # Core gateway features
│   ├── routing/         # Request routing logic
│   ├── load-balancer/   # Load balancing algorithms
│   ├── circuit-breaker/ # Resilience patterns
│   └── cache/           # Caching layer
├── validation/           # Zod schemas and pipes
├── config/              # Configuration management
├── middleware/          # Custom middleware
├── filters/             # Exception filters
├── interceptors/        # Request/response interceptors
└── monitoring/          # Observability features

test/                    # Jest + Supertest tests
docs/                    # API documentation
docker/                  # Multi-stage Dockerfile
k8s/                     # Kubernetes manifests
.claude/                 # Claude Code commands
```

## Essential Commands

### Essential Commands (Makefile-based)

**Core Development**:

-   `make dev`: Start development server with tsx
-   `make build`: Production build with NestJS CLI
-   `make test`: Run Jest test suite
-   `make validate`: TypeScript check + tests

**Package.json Scripts (minimal)**:

-   `npm run dev`: Direct tsx execution
-   `npm run build`: NestJS build
-   `npm run start`: Production server
-   `npm run test`: Jest testing

**Extended Commands via Makefile**:

-   `make docker-build`: Build optimized container
-   `make k8s-deploy`: Deploy to Kubernetes
-   `make health`: Health check endpoint
-   `make help`: Show all available commands

## Code Style & Patterns

### TypeScript Conventions

-   Use ES modules (import/export) - NO CommonJS (require)
-   Prefer arrow functions for components and handlers
-   Use strict TypeScript configuration
-   Destructure imports when possible: `import { Injectable } from '@nestjs/common'`

### NestJS Patterns

-   Use dependency injection consistently
-   Implement custom guards for authentication (NO Passport.js)
-   Use Zod for validation (NO class-validator)
-   Prefer Fastify-specific features over Express compatibility

### Authentication Implementation

```typescript
// Custom JWT Guard Example (NO Passport)
@Injectable()
export class JwtAuthGuard implements CanActivate {
	constructor(private jwtService: JwtService) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const request = context.switchToHttp().getRequest();
		const token = this.extractTokenFromHeader(request);

		if (!token) throw new UnauthorizedException();

		try {
			const payload = await this.jwtService.verifyAsync(token);
			request['user'] = payload;
			return true;
		} catch {
			throw new UnauthorizedException();
		}
	}
}
```

### Validation with Zod

```typescript
// Use Zod instead of class-validator
const CreateUserSchema = z.object({
	name: z.string().min(2).max(50),
	email: z.string().email(),
	age: z.number().min(18).max(100),
});

export class ZodValidationPipe implements PipeTransform {
	constructor(private schema: ZodSchema) {}

	transform(value: any) {
		const result = this.schema.safeParse(value);
		if (!result.success) {
			throw new BadRequestException(result.error.issues);
		}
		return result.data;
	}
}
```

### HTTP Client with Native Fetch

```typescript
// Use native fetch instead of axios
async makeApiCall(url: string, data?: any) {
  const response = await fetch(url, {
    method: data ? 'POST' : 'GET',
    body: data ? JSON.stringify(data) : undefined,
    headers: { 'Content-Type': 'application/json' }
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
}
```

## Performance Requirements

### Fastify Configuration

-   Enable logging in development
-   Configure trustProxy for production
-   Use async/await for all handlers
-   Implement proper error boundaries

### Memory Optimization

-   Use connection pooling for database connections
-   Implement response compression
-   Configure garbage collection tuning
-   Monitor memory usage patterns

### Caching Strategy

-   Redis for distributed caching
-   Request deduplication for identical calls
-   TTL-based cache invalidation
-   Cache-aside pattern implementation

## Security Standards

### Authentication & Authorization

-   Use Argon2id for password hashing (NOT bcrypt)
-   Implement JWT with proper expiration
-   Role-based access control (RBAC)
-   Rate limiting per endpoint and user

### Input Validation

-   Validate all inputs with Zod schemas
-   Sanitize user inputs
-   Implement request size limits
-   Use helmet for security headers

### Network Security

-   TLS everywhere (no plain HTTP)
-   CORS configuration for production
-   Request ID correlation for tracing
-   Audit logging for security events

## Testing Strategy

### Unit Tests

-   Test all business logic with Jest
-   Mock external dependencies
-   Achieve >90% coverage for critical paths
-   Test error conditions thoroughly

### Integration Tests

-   Use Supertest for API testing
-   Test authentication flows end-to-end
-   Validate error responses
-   Test rate limiting behavior

### Performance Tests

-   Benchmark against Express baseline
-   Load test with realistic traffic patterns
-   Memory leak detection
-   Response time validation

## Monitoring & Observability

### Logging

-   Structured JSON logging
-   Correlation IDs for request tracing
-   Error stack traces in development
-   Log level configuration per environment

### Metrics

-   RED metrics (Rate, Errors, Duration)
-   Custom business metrics
-   Resource utilization monitoring
-   Circuit breaker state tracking

### Health Checks

-   Database connectivity
-   External service dependencies
-   Memory and CPU usage
-   Circuit breaker status

## Docker & Deployment

### Multi-stage Build

-   Use Node.js 20-alpine base image
-   Separate build and runtime stages
-   Non-root user for security
-   Minimal production image

### Kubernetes

-   Resource limits and requests
-   Liveness and readiness probes
-   ConfigMap for configuration
-   Horizontal Pod Autoscaling

## Critical DO NOTs

❌ **Never add dependencies beyond the optimized 19-package stack** (11 prod + 8 dev)
❌ **Never add Passport.js** - Use custom JWT guards only
❌ **Never use Express** - Fastify is performance critical
❌ **Never use axios** - Native fetch only
❌ **Never use bcrypt** - Argon2id is required
❌ **Never use class-validator** - Zod only
❌ **Never use ts-node** - tsx for development
❌ **Never add RxJS** - Keep minimal for simple routing
❌ **Never add ESLint/Prettier** - Maintain minimal dev stack
❌ **Never commit sensitive data** - Use environment variables
❌ **Never ignore error handling** - Comprehensive error boundaries
❌ **Never skip input validation** - Validate everything with Zod
❌ **Never use synchronous operations** - Async/await everywhere

## Claude Code Integration

### Custom Commands Available

-   `/project:build-feature`: Scaffold new gateway feature
-   `/project:add-route`: Add new routing configuration
-   `/project:security-review`: Comprehensive security audit
-   `/project:performance-test`: Run performance benchmarks
-   `/project:deploy-check`: Pre-deployment validation

### Workflow Preferences

1. **Plan First**: Always create implementation plan before coding
2. **Test-Driven**: Write tests before implementation
3. **Security-First**: Consider security implications in every change
4. **Performance-Aware**: Profile changes for performance impact
5. **Documentation**: Update relevant docs with code changes

### Context Management

-   Use `/clear` when switching between major features
-   Reference this CLAUDE.md for project-specific guidance
-   Tag relevant files with @ when discussing specific implementations
-   Use `/compact` at natural breakpoints to preserve context

This gateway represents state-of-the-art API infrastructure for 2025, optimized for performance, security, and developer productivity.
