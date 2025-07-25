# NestJS API Gateway - Minimalist Makefile
# Follows 2025 optimization principles with essential commands only

# Variables
APP_NAME := nestjs-api-gateway
PORT := 3000
NODE_ENV := development

# Default target
.DEFAULT_GOAL := help

# Core Development Commands
.PHONY: dev
dev: ## Start development server
	@tsx src/main.ts

.PHONY: build
build: ## Build for production
	@npm run build

.PHONY: start
start: ## Start production server
	@npm run start

.PHONY: test
test: ## Run tests
	@npm run test

# Extended Development Commands
.PHONY: dev-watch
dev-watch: ## Start development with watch mode
	@tsx --watch src/main.ts

.PHONY: dev-debug
dev-debug: ## Start development with debugging
	@tsx --inspect-brk src/main.ts

.PHONY: typecheck
typecheck: ## Run TypeScript type checking
	@npx tsc --noEmit

# Testing Variations
.PHONY: test-watch
test-watch: ## Run tests in watch mode
	@npx jest --watch

.PHONY: test-coverage
test-coverage: ## Run tests with coverage
	@npx jest --coverage

.PHONY: test-e2e
test-e2e: ## Run end-to-end tests
	@npx jest --config ./test/jest-e2e.json

# Quality Assurance
.PHONY: validate
validate: typecheck test ## Run all validation (typecheck + test)

.PHONY: security-scan
security-scan: ## Run npm security audit
	@npm audit --audit-level moderate

# Docker Operations
.PHONY: docker-build
docker-build: ## Build Docker image
	@docker build -t $(APP_NAME) .

.PHONY: docker-run
docker-run: ## Run Docker container
	@docker run -p $(PORT):$(PORT) $(APP_NAME)

.PHONY: docker-dev
docker-dev: ## Start development with Docker Compose
	@docker compose up -d

.PHONY: docker-down
docker-down: ## Stop Docker Compose services
	@docker compose down

# Kubernetes Operations
.PHONY: k8s-deploy
k8s-deploy: ## Deploy to Kubernetes
	@kubectl apply -f k8s/

.PHONY: k8s-delete
k8s-delete: ## Delete from Kubernetes
	@kubectl delete -f k8s/

.PHONY: k8s-status
k8s-status: ## Check Kubernetes deployment status
	@kubectl get pods -l app=$(APP_NAME)

# Monitoring & Health
.PHONY: health
health: ## Check application health
	@curl -f http://localhost:$(PORT)/health || exit 1

.PHONY: metrics
metrics: ## View application metrics
	@curl -s http://localhost:$(PORT)/metrics

.PHONY: logs
logs: ## View application logs (requires running container)
	@docker logs $$(docker ps -q --filter ancestor=$(APP_NAME)) -f

# Utility Commands
.PHONY: clean
clean: ## Clean build artifacts
	@rm -rf dist coverage node_modules/.cache

.PHONY: clean-all
clean-all: clean ## Clean everything including node_modules
	@rm -rf node_modules

.PHONY: install
install: ## Install dependencies
	@npm ci

.PHONY: deps-check
deps-check: ## Check for dependency updates
	@npm outdated

# Environment Management
.PHONY: env-dev
env-dev: ## Set development environment
	$(eval NODE_ENV := development)
	@echo "Environment set to development"

.PHONY: env-prod
env-prod: ## Set production environment
	$(eval NODE_ENV := production)
	@echo "Environment set to production"

# Combined Workflows
.PHONY: fresh-start
fresh-start: clean-all install dev ## Clean install and start development

.PHONY: ci-pipeline
ci-pipeline: install validate build ## Run CI pipeline (install, validate, build)

.PHONY: deploy-check
deploy-check: validate security-scan build ## Pre-deployment validation

.PHONY: full-test
full-test: test test-e2e test-coverage ## Run all test suites

# Help target
.PHONY: help
help: ## Show this help message
	@echo "NestJS API Gateway - Available Commands:"
	@echo ""
	@awk 'BEGIN {FS = ":.*##"} /^[a-zA-Z_-]+:.*?##/ { printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)
	@echo ""
	@echo "Core Commands:"
	@echo "  make dev          - Start development server"
	@echo "  make build        - Build for production"
	@echo "  make test         - Run tests"
	@echo "  make validate     - Run typecheck + test"
	@echo ""
	@echo "Docker:"
	@echo "  make docker-build - Build container"
	@echo "  make docker-dev   - Start with compose"
	@echo ""
	@echo "For more commands, see: make help"