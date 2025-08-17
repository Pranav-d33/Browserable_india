# Bharat Agents

A comprehensive automation and task management platform built with modern web technologies.

## 🚀 Overview

Bharat Agents is a monorepo containing multiple applications and packages designed to provide a complete automation and task management solution. The platform consists of:

- **Tasks App**: A Node.js + Express + TypeScript backend service for task management
- **Browser App**: A Node.js + Playwright API service for web automation
- **Shared Package**: Common types and utilities shared across applications
- **Infrastructure**: Docker Compose setup for local development and deployment

## 📁 Project Structure

```
bharat-agents/
├── apps/
│   ├── tasks/          # Task management API (Node.js + Express + TypeScript)
│   └── browser/        # Browser automation API (Node.js + Playwright + TypeScript)
├── packages/
│   └── shared/         # Shared types and utilities
├── infra/
│   └── deployment/     # Docker Compose and deployment configurations
└── docs/              # Documentation
```

## 🛠️ Tech Stack

- **Runtime**: Node.js 20+ (ESM)
- **Package Manager**: pnpm
- **Language**: TypeScript (strict mode)
- **Linting**: ESLint + Prettier
- **Testing**: Jest + Playwright
- **Containerization**: Docker + Docker Compose
- **CI/CD**: GitHub Actions

## 🚀 Quick Start

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js 20+** - [Download](https://nodejs.org/) or [Install via nvm](https://github.com/nvm-sh/nvm)
- **pnpm 8+** - `npm install -g pnpm`
- **Docker & Docker Compose** - [Download](https://www.docker.com/)
- **Playwright browsers** - `npx playwright install`

### Quick Install Commands

```bash
# Install Node.js 20+ (macOS with Homebrew)
brew install node@20

# Install pnpm globally
npm install -g pnpm

# Install Playwright browsers
npx playwright install

# Verify installations
node --version  # Should be 20.x.x
pnpm --version  # Should be 8.x.x
docker --version
```

## 🚀 Quick Setup (Recommended)

### Option 1: Local Development Setup (Free Tier)

For cost-optimized local development using free services:

```bash
# 1. Run the setup script (Linux/macOS)
chmod +x scripts/setup-local-dev.sh && ./scripts/setup-local-dev.sh

# Or on Windows
scripts/setup-local-dev.bat

# 2. Update your Gemini API key in apps/tasks/.env.local
# Get a free key from: https://makersuite.google.com/app/apikey

# 3. Start the tasks service
pnpm --filter @bharat-agents/tasks dev

# 4. Start the browser service (in another terminal)
pnpm --filter @bharat-agents/browser dev
```

### Option 2: Full Infrastructure Setup (Docker)

For production-like development with all services:

```bash
# 1. Start infrastructure services
cd infra/deployment && cp .env.example .env && docker compose -f docker-compose.dev.yml up -d

# 2. Install dependencies and build
pnpm i && pnpm -w build

# 3. Set up database and seed data
pnpm --filter @bharat-agents/tasks prisma migrate dev && pnpm --filter @bharat-agents/tasks db:seed

# 4. Start the tasks service
pnpm --filter @bharat-agents/tasks dev

# 5. Start the browser service (in another terminal)
pnpm --filter @bharat-agents/browser dev
```

### All-in-One Setup Script (Local Development)

```bash
# Complete local setup in one go
chmod +x scripts/setup-local-dev.sh && ./scripts/setup-local-dev.sh
```

### Test the API

```bash
# Health check (no authentication required)
curl -X GET http://localhost:3001/health

# Create a task with idempotency (requires authentication)
curl -X POST http://localhost:3001/v1/tasks/create \
  -H 'content-type: application/json' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -H 'Idempotency-Key: demo-123' \
  -d '{"agent":"echo","input":"hello india"}'

# List runs (requires authentication)
curl -X GET http://localhost:3001/v1/runs \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN'

# Expected response:
# {
#   "runId": "clx...",
#   "status": "COMPLETED",
#   "agent": "echo",
#   "input": "hello india",
#   "output": "hello india",
#   "createdAt": "2024-01-01T00:00:00.000Z"
# }
```

### Development Authentication

For development, you can create a test JWT token:

```bash
# In the tasks app directory
cd apps/tasks
node -e "
const { createDevToken } = require('./dist/security/auth.js');
console.log('Dev Token:', createDevToken('dev-user', 'dev@bharat-agents.com', 'admin'));
"
```

## 🆕 Local Development Features

### Cost-Optimized Setup

The platform now supports a **completely free local development setup** using:

- **🤖 Google Gemini API** - Free tier LLM (replaces OpenAI)
- **💾 SQLite Database** - Local file-based database (replaces PostgreSQL)
- **📁 Local File Storage** - File system storage (replaces S3/MinIO)
- **🌐 Playwright Chromium** - Bundled browser automation

### Key Benefits

✅ **Zero Infrastructure Costs** - No Docker, no cloud services required  
✅ **Instant Setup** - Single script setup for local development  
✅ **Production Ready** - Same APIs, same security, same scalability hooks  
✅ **Easy Migration** - Switch to production services with environment variables

### Environment Configuration

The system automatically detects your environment and uses the appropriate services:

```bash
# Local development (free tier)
USE_SQLITE=true
USE_LOCAL_STORAGE=true
GEMINI_API_KEY=your_free_gemini_key

# Production (full infrastructure)
POSTGRES_URL=postgresql://...
S3_ENDPOINT=https://...
OPENAI_API_KEY=your_openai_key
```

### Service Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Tasks API     │    │  Browser API    │    │   Shared Utils  │
│   (Port 3001)   │    │  (Port 3002)    │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   SQLite DB     │    │  Local Storage  │    │   Gemini LLM    │
│   (local.db)    │    │   (uploads/)    │    │   (Free Tier)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🔧 Troubleshooting

### Common Issues

#### Local Development Issues

```bash
# Error: "GEMINI_API_KEY not found"
# Solution: Get a free API key from https://makersuite.google.com/app/apikey

# Error: "Database connection failed"
# Solution: Check that USE_SQLITE=true in your .env.local

# Error: "Storage service failed"
# Solution: Ensure uploads/ directory exists and is writable
```

#### PostgreSQL Authentication Issues

```bash
# Error: "password authentication failed"
# Solution: Check your POSTGRES_URL in .env files
# Default credentials: postgres/postgres

# Reset PostgreSQL password
docker exec -it bharat-agents-postgres psql -U postgres -c "ALTER USER postgres PASSWORD 'postgres';"
```

#### Redis Connection Issues

```bash
# Error: "Redis connection refused"
# Solution: Check if Redis is running
docker ps | grep redis

# Restart Redis container
docker restart bharat-agents-redis

# Check Redis logs
docker logs bharat-agents-redis
```

#### High Redis Latency

```bash
# Monitor Redis performance
docker exec -it bharat-agents-redis redis-cli --latency

# Check Redis memory usage
docker exec -it bharat-agents-redis redis-cli info memory

# Restart Redis if needed
docker restart bharat-agents-redis
```

#### Playwright Missing Dependencies

```bash
# Error: "Playwright browsers not found"
# Solution: Install Playwright browsers
npx playwright install

# For Linux systems, install additional dependencies
npx playwright install-deps

# Verify installation
npx playwright --version
```

#### Port Conflicts

```bash
# Check what's using port 3001
lsof -i :3001  # macOS/Linux
netstat -ano | findstr :3001  # Windows

# Kill process using the port
kill -9 <PID>  # macOS/Linux
taskkill /PID <PID> /F  # Windows
```

#### Docker Issues

```bash
# Clean up Docker resources
docker system prune -a

# Reset Docker containers
docker compose -f infra/deployment/docker-compose.dev.yml down -v
docker compose -f infra/deployment/docker-compose.dev.yml up -d

# Check Docker logs
docker logs bharat-agents-postgres
docker logs bharat-agents-redis
docker logs bharat-agents-minio
```

#### Environment Variable Issues

```bash
# Verify environment files exist
ls -la apps/tasks/.env
ls -la infra/deployment/.env

# Regenerate environment files
cp apps/tasks/env.example apps/tasks/.env
cp infra/deployment/env.example infra/deployment/.env

# Check environment validation
cd apps/tasks && npm run dev
```

### Manual Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/Pranav-d33/Browserable_india.git
   cd Browserable_india
   ```

2. **Install dependencies**

   ```bash
   pnpm install
   ```

3. **Set up environment variables**

   ```bash
   # Run the setup script (recommended)
   # Windows:
   scripts\setup-env.bat

   # Linux/macOS:
   ./scripts/setup-env.sh

   # Or manually copy example files:
   cp env.example .env
   cp apps/tasks/env.example apps/tasks/.env.development.local
   cp apps/browser/env.example apps/browser/.env.development.local
   cp infra/deployment/env.example infra/deployment/.env

   # Edit the .env files with your configuration
   ```

4. **Start development environment**

   ```bash
   # Start all services
   pnpm dev

   # Or start individual services
   pnpm --filter tasks dev
   pnpm --filter browser dev
   ```

### Development Commands

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Lint code
pnpm lint

# Format code
pnpm format

# Type checking
pnpm type-check

# Clean build artifacts
pnpm clean
```

## 📦 Workspace Packages

### Apps

#### `apps/tasks`

Task management API built with Express and TypeScript.

```bash
cd apps/tasks
pnpm dev          # Start development server
pnpm build        # Build for production
pnpm test         # Run tests
```

#### `apps/browser`

Browser automation API using Playwright.

```bash
cd apps/browser
pnpm dev          # Start development server
pnpm build        # Build for production
pnpm test         # Run Playwright tests
```

### Packages

#### `packages/shared`

Shared types, utilities, and common functionality.

```bash
cd packages/shared
pnpm build        # Build package
pnpm test         # Run tests
```

## 🐳 Docker Development

The project includes Docker Compose configuration for easy local development:

### Quick Start

```bash
# Navigate to infrastructure directory
cd infra/deployment

# Copy environment template
cp env.example .env

# Start all services
make up

# View logs
make logs

# Stop services
make down
```

### Services

- **PostgreSQL 16**: Database (`localhost:5432`)
- **Redis 7**: Cache (`localhost:6379`)
- **MinIO**: S3-compatible storage (`localhost:9000`, UI: `localhost:9001`)
- **MailHog**: Email testing (`localhost:8025`)

### Management Commands

```bash
# Using Make (Linux/macOS)
make up          # Start services
make down        # Stop services
make logs        # Show logs
make nuke        # Stop and remove volumes
make status      # Show status

# Using Batch (Windows)
Makefile.bat up
Makefile.bat down
Makefile.bat logs
Makefile.bat nuke
Makefile.bat status
```

See [infra/deployment/README.md](infra/deployment/README.md) for detailed documentation.

## 🧪 Testing

```bash
# Run all tests
pnpm test

# Run tests with coverage
pnpm test:coverage

# Run Playwright tests
pnpm test:e2e

# Run tests in watch mode
pnpm test:watch
```

## 📝 Code Quality

This project uses strict code quality standards:

- **ESLint**: Strict TypeScript linting rules
- **Prettier**: Consistent code formatting
- **Husky**: Git hooks for pre-commit checks
- **Commitlint**: Conventional commit message validation
- **TypeScript**: Strict type checking

### Pre-commit Hooks

The following checks run automatically on commit:

- ESLint linting
- Prettier formatting
- TypeScript type checking
- Test execution

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests and linting (`pnpm test && pnpm lint`)
5. Commit your changes (`git commit -m 'feat: add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### Commit Message Convention

This project follows [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` New features
- `fix:` Bug fixes
- `docs:` Documentation changes
- `style:` Code style changes (formatting, etc.)
- `refactor:` Code refactoring
- `test:` Adding or updating tests
- `chore:` Maintenance tasks

## 📈 Scalability Notes

### Architecture Overview

The system is designed for horizontal scaling with stateless APIs and queue-based processing:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Load Balancer │───▶│  Tasks Service  │───▶│   Queue (Redis) │
│   (Nginx/ALB)   │    │   (Stateless)   │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │                       │
                                ▼                       ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │  Browser Service│    │  Worker Process │
                       │   (Stateless)   │    │   (Scalable)    │
                       └─────────────────┘    └─────────────────┘
```

### Horizontal Scaling Strategy

#### 1. **Stateless API Services**

- **Tasks Service**: No local state, can scale horizontally
- **Browser Service**: Stateless, multiple instances supported
- **Session Management**: Redis-based, shared across instances

#### 2. **Queue-Based Processing**

```bash
# Redis Queue Configuration
REDIS_URL=redis://redis-cluster:6379
QUEUE_NAME=bharat-agents-tasks
WORKER_CONCURRENCY=5  # Adjust based on CPU cores
```

#### 3. **Database Scaling**

```bash
# PostgreSQL Read Replicas
POSTGRES_URL=postgresql://user:pass@primary:5432/db
POSTGRES_READ_REPLICA_URL=postgresql://user:pass@replica:5432/db

# Connection Pooling
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=20
```

#### 4. **Caching Strategy**

```bash
# Redis Cluster for High Availability
REDIS_CLUSTER_NODES=redis-node1:6379,redis-node2:6379,redis-node3:6379

# Cache Configuration
CACHE_TTL=3600  # 1 hour
SESSION_TTL=86400  # 24 hours
```

### Scaling Commands

#### Scale Services

```bash
# Scale tasks service
docker compose up -d --scale tasks=3

# Scale browser service
docker compose up -d --scale browser=2

# Scale with Kubernetes
kubectl scale deployment tasks-service --replicas=5
kubectl scale deployment browser-service --replicas=3
```

#### Monitor Scaling

```bash
# Check service health
curl http://localhost:3001/health

# Monitor queue depth
redis-cli llen bharat-agents-tasks

# Check database connections
docker exec postgres psql -c "SELECT count(*) FROM pg_stat_activity;"
```

### Performance Optimization

#### 1. **Database Optimization**

```sql
-- Add indexes for common queries
CREATE INDEX CONCURRENTLY idx_runs_user_created ON runs(user_id, created_at);
CREATE INDEX CONCURRENTLY idx_runs_status ON runs(status);

-- Partition large tables
CREATE TABLE runs_2024 PARTITION OF runs FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');
```

#### 2. **Redis Optimization**

```bash
# Configure Redis for performance
redis-cli config set maxmemory 2gb
redis-cli config set maxmemory-policy allkeys-lru
redis-cli config set save ""
```

#### 3. **Application Optimization**

```bash
# Node.js performance tuning
NODE_OPTIONS="--max-old-space-size=4096"
UV_THREADPOOL_SIZE=64

# PM2 clustering
pm2 start dist/index.js -i max --name tasks-service
```

### Load Testing

```bash
# Install load testing tools
npm install -g artillery

# Run load test
artillery run load-test.yml

# Monitor during load test
docker stats
redis-cli info memory
```

### Auto-Scaling Configuration

#### Docker Swarm

```yaml
version: '3.8'
services:
  tasks:
    deploy:
      replicas: 3
      update_config:
        parallelism: 1
        delay: 10s
      restart_policy:
        condition: on-failure
      resources:
        limits:
          cpus: '1.0'
          memory: 1G
```

#### Kubernetes HPA

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: tasks-service-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: tasks-service
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
```

## 📄 License

## 🔒 Security Notes

### Environment Secrets Management

⚠️ **Critical Security Guidelines:**

- **Never commit `.env*` files** to version control
- **Use strong, unique secrets** for each environment
- **Rotate tokens regularly** (JWT secrets, API keys, database passwords)
- **Use secret management tools** in production (Doppler, 1Password, AWS SSM)

### Development Security

```bash
# ✅ Good: Use .env.example as template
cp env.example .env

# ❌ Bad: Never do this
git add .env
git commit -m "Add environment variables"

# ✅ Good: Use environment-specific files
cp apps/tasks/env.example apps/tasks/.env.development.local
```

### Production Security Checklist

- [ ] **JWT_SECRET**: 32+ character random string
- [ ] **Database passwords**: Strong, unique passwords
- [ ] **API keys**: Rotate regularly, use least privilege
- [ ] **CORS origins**: Whitelist specific domains only
- [ ] **Rate limiting**: Configure appropriate limits
- [ ] **HTTPS only**: Enforce TLS in production
- [ ] **Security headers**: Helmet.js configured
- [ ] **Input validation**: All endpoints validated
- [ ] **SQL injection protection**: Prisma ORM used
- [ ] **XSS prevention**: Input sanitization enabled

### Secret Rotation

```bash
# Generate new JWT secret
openssl rand -base64 32

# Update environment variables
# 1. Update in secret management tool
# 2. Deploy with new secrets
# 3. Invalidate old tokens
# 4. Monitor for any issues
```

## Security

### Environment Variables

The application enforces strict environment variable validation:

- **Development**: Most variables are optional with sensible defaults
- **Production**: All required variables must be set and validated
- **JWT Secret**: Must be at least 32 characters in production

### Authentication & Authorization

- **JWT-based authentication** with role-based access control (RBAC)
- **Admin routes** are protected and require admin role
- **User routes** require valid authentication
- **Health endpoints** are publicly accessible

### Security Features

- **CORS protection** with environment-specific rules
- **Rate limiting** to prevent abuse
- **Input validation** and sanitization
- **SQL injection protection** via Prisma ORM
- **XSS prevention** through input validation
- **Non-root Docker containers** for production

### Security Monitoring

- **CodeQL analysis** runs on every PR and weekly
- **Dependency audits** fail CI on high vulnerabilities
- **Health monitoring** with pressure detection
- **Comprehensive logging** for security events

### Production Checklist

- [ ] Set strong JWT_SECRET (32+ characters)
- [ ] Configure production database and Redis URLs
- [ ] Set up S3-compatible storage
- [ ] Configure CORS origins for production
- [ ] Set up monitoring and alerting
- [ ] Review and update rate limits
- [ ] Set up secret management (Doppler, 1Password, etc.)

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔒 Security & Secret Management

### Environment Configuration

This project follows **secure-by-default** principles. Never commit real secrets to version control!

- **Development**: Use `.env.development.local` files for local development
- **Production**: Use secret management tools like Doppler, 1Password, or AWS SSM
- **Documentation**: See [docs/SECRET_MANAGEMENT.md](docs/SECRET_MANAGEMENT.md) for detailed instructions

### Quick Setup

```bash
# Run the environment setup script
scripts/setup-env.bat  # Windows
./scripts/setup-env.sh # Linux/macOS

# Update the generated .env files with your values
# For production, use secret management tools
```

### Secret Management Tools

- **Doppler** (Recommended): [docs.doppler.com](https://docs.doppler.com/)
- **1Password CLI**: [developer.1password.com/docs/cli/](https://developer.1password.com/docs/cli/)
- **AWS SSM Parameter Store**: [docs.aws.amazon.com/systems-manager/latest/userguide/systems-manager-parameter-store.html](https://docs.aws.amazon.com/systems-manager/latest/userguide/systems-manager-parameter-store.html)

### Security Vulnerabilities

Please report security vulnerabilities to [security@bharat-agents.com](mailto:security@bharat-agents.com). See [SECURITY.md](SECURITY.md) for more details.

## 🧪 Testing

### End-to-End Tests

The project includes comprehensive end-to-end tests that validate the complete flow from API request to browser automation:

```bash
# Run e2e tests
pnpm test:e2e

# Run specific e2e test
pnpm test:e2e -- --run e2e.browser.flow.spec.ts
```

**E2E Test Coverage:**

- ✅ **Form Autofill Flow**: Tests form filling and submission with artifact creation
- ✅ **Price Monitor Flow**: Tests price extraction from web pages
- ✅ **Mock LLM**: Uses mock LLM responses to avoid API costs during testing
- ✅ **Test Fixtures**: Includes HTTP server with sample pages for testing
- ✅ **Error Handling**: Validates graceful error handling for invalid URLs

### Load Testing

The project includes k6 load testing scripts to validate performance under load:

```bash
# Install k6 (if not already installed)
# macOS: brew install k6
# Windows: choco install k6
# Linux: https://k6.io/docs/getting-started/installation/

# Run load test against local environment
k6 run scripts/k6-price-monitor.js

# Run load test against staging/production
TASKS_URL=https://staging-api.example.com k6 run scripts/k6-price-monitor.js

# Run with custom configuration
k6 run --env VUS=100 --env DURATION=5m scripts/k6-price-monitor.js
```

**Load Test Configuration:**

- **Virtual Users**: 50 concurrent users
- **Duration**: 3 minutes (30s ramp up, 2m steady, 30s ramp down)
- **Target**: Price monitor flow endpoint
- **Thresholds**:
  - P95 latency < 5 seconds
  - Error rate < 5%
  - HTTP request duration < 3 seconds (P95)

**Load Test Features:**

- ✅ **Realistic Data**: Random product URLs and selectors
- ✅ **Custom Metrics**: Price monitor specific latency tracking
- ✅ **Threshold Validation**: Automatic pass/fail based on performance criteria
- ✅ **Detailed Reporting**: JSON and text summaries with performance metrics
- ✅ **Error Tracking**: Comprehensive error rate monitoring

**Sample Load Test Results:**

```
Load Test Results - Price Monitor Flow
=====================================

Test Configuration:
- Virtual Users: 50
- Duration: 3 minutes (30s ramp up, 2m steady, 30s ramp down)
- Target: http://localhost:3001/v1/flows/price-monitor

Performance Metrics:
- Total Requests: 2,847
- Requests/sec: 15.82
- Average Response Time: 1,234ms
- P95 Response Time: 3,456ms
- Error Rate: 0.12%

Threshold Results:
- P95 Latency < 5s: PASS
- Error Rate < 5%: PASS
```

### Test Environment Setup

The e2e tests automatically set up:

- **Test HTTP Server**: Serves sample pages for form and price testing
- **Mock Browser App**: Simulates browser automation responses
- **Mock LLM Service**: Avoids actual API calls during testing
- **Database Mocks**: Isolates tests from actual database operations

## 🆘 Support

- 📧 Email: [support@bharat-agents.com](dhiranpranav72@gmail.com)
- 🐛 Issues: [GitHub Issues](https://github.com/Pranav-d33/Browserable_india/issues)
- 📖 Documentation: [Wiki](https://github.com/Pranav-d33/Browserable_india/wiki)

## 🙏 Acknowledgments

- [Express.js](https://expressjs.com/) - Web framework
- [Playwright](https://playwright.dev/) - Browser automation
- [TypeScript](https://www.typescriptlang.org/) - Type safety
- [pnpm](https://pnpm.io/) - Fast package manager
