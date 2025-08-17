# @bharat-agents/shared

Shared types, utilities, and configuration for Bharat Agents microservices.

## Features

- **Environment Configuration**: Secure-by-default environment variable validation with Zod schemas
- **Structured Logging**: Pino-based logging with automatic redaction of sensitive data
- **Error Handling**: Comprehensive error classes and Express middleware
- **Common Types**: TypeScript types and interfaces used across the application
- **ID Management**: ULID-based ID generation and validation with type safety
- **Role-Based Access Control (RBAC)**: JWT-based authentication and authorization middleware
- **Metrics & Monitoring**: Prometheus metrics collection and OpenTelemetry integration
- **Cost Tracking**: LLM cost calculation and tracking for multiple providers

## Installation

```bash
pnpm add @bharat-agents/shared
```

## Environment Configuration

The shared package provides secure environment variable validation using Zod schemas.

### Required Environment Variables

```bash
# Database
POSTGRES_URL=postgresql://username:password@localhost:5432/database_name

# Cache
REDIS_URL=redis://localhost:6379

# Storage
S3_ENDPOINT=https://s3.amazonaws.com
S3_ACCESS_KEY=your_s3_access_key
S3_SECRET_KEY=your_s3_secret_key

# Security
JWT_SECRET=your_very_long_jwt_secret_key_at_least_32_characters_long
JWT_ISSUER=bharat-agents
JWT_AUDIENCE=bharat-agents-api
ALLOW_INSECURE_DEV=true

# Application
NODE_ENV=development
PORT=3000
SERVICE_NAME=bharat-agents
SERVICE_VERSION=1.0.0

# OpenTelemetry (Optional)
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
OTEL_EXPORTER_OTLP_HEADERS={"Authorization": "Bearer your-token"}
```

### Optional Environment Variables

```bash
# AI/ML (Optional in Phase 0)
OPENAI_API_KEY=sk-your-openai-api-key
```

### Usage

```typescript
import { env } from '@bharat-agents/shared';

// Access validated environment variables
console.log(env.POSTGRES_URL);
console.log(env.PORT); // number, not string
console.log(env.NODE_ENV); // 'development' | 'production' | 'test'
```

## Logging

The shared package provides structured logging with automatic redaction of sensitive data.

### Features

- **Automatic Redaction**: Sensitive data like passwords, tokens, and keys are automatically redacted
- **Environment-Aware**: Pretty printing in development, JSON in production
- **Request/Response Serialization**: Built-in serializers for Express requests and responses
- **Context Support**: Create child loggers with context

### Usage

```typescript
import { logger, createLogger } from '@bharat-agents/shared';

// Basic logging
logger.info('Application started');
logger.error(new Error('Something went wrong'), 'Error occurred');

// Create child logger with context
const taskLogger = createLogger('TaskService');
taskLogger.info('Task created', { taskId: '123' });

// Sensitive data is automatically redacted
logger.info('User login', {
  userId: '123',
  password: 'secret123', // This will be redacted
  token: 'jwt-token', // This will be redacted
});
```

### Redaction Patterns

The following patterns are automatically redacted:

- `authorization`, `cookie`, `password`, `secret`
- `token`, `key`, `credential`, `api_key`
- `access_token`, `refresh_token`, `private_key`, `public_key`
- `session_id`, `auth_token`, `bearer`, `basic`

## Error Handling

Comprehensive error handling with typed error classes and Express middleware.

### Error Classes

```typescript
import {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  ExternalServiceError,
} from '@bharat-agents/shared';

// Create specific errors
throw new ValidationError('Invalid email format', { field: 'email' });
throw new AuthenticationError('Invalid credentials');
throw new NotFoundError('User');
throw new ConflictError('Email already exists', { email: 'user@example.com' });
```

### Express Error Middleware

```typescript
import { createErrorMiddleware, asyncHandler } from '@bharat-agents/shared';
import express from 'express';

const app = express();

// Wrap async route handlers
app.get(
  '/users/:id',
  asyncHandler(async (req, res) => {
    const user = await getUser(req.params.id);
    if (!user) {
      throw new NotFoundError('User');
    }
    res.json(user);
  })
);

// Error middleware (add last)
app.use(createErrorMiddleware());
```

### Error Response Format

```json
{
  "message": "User not found",
  "type": "NOT_FOUND",
  "code": "NOT_FOUND_ERROR",
  "details": {
    "resource": "User"
  }
}
```

## Common Types

The shared package exports common TypeScript types used across the application.

### Core Identifiers

```typescript
import {
  RunId,
  NodeId,
  UserId,
  TaskId,
  BrowserActionId,
  SessionId,
  RequestId,
} from '@bharat-agents/shared';

// These are string type aliases for better type safety
const userId: UserId = 'user-123';
const taskId: TaskId = 'task-456';
```

### Enums

```typescript
import {
  Role,
  Permission,
  Status,
  RunStatus,
  NodeType,
  TaskStatus,
  TaskPriority,
  BrowserActionType,
  BrowserActionStatus,
} from '@bharat-agents/shared';

// Role and permissions
const userRole: Role = Role.USER;
const permissions: Permission[] = [Permission.READ, Permission.WRITE];

// Status enums
const taskStatus: TaskStatus = TaskStatus.IN_PROGRESS;
const runStatus: RunStatus = RunStatus.RUNNING;

// Node types for workflow execution
const nodeType: NodeType = NodeType.TASK;
```

### Interfaces

```typescript
import {
  User,
  Task,
  BrowserAction,
  Node,
  Run,
  ApiResponse,
  PaginatedResponse,
} from '@bharat-agents/shared';

// User interface
const user: User = {
  id: 'user-123',
  email: 'user@example.com',
  name: 'John Doe',
  role: Role.USER,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Task interface
const task: Task = {
  id: 'task-456',
  title: 'Complete documentation',
  description: 'Update API documentation',
  status: TaskStatus.TODO,
  priority: TaskPriority.HIGH,
  createdAt: new Date(),
  updatedAt: new Date(),
  dueDate: new Date('2024-01-15'),
  assignedTo: 'user-123',
  tags: ['documentation', 'api'],
};
```

## Development

### Running Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage
```

### Building

```bash
# Build the package
pnpm build

# Build in watch mode
pnpm dev
```

### Linting

```bash
# Lint the code
pnpm lint

# Fix linting issues
pnpm lint:fix
```

## ID Management

The shared package provides ULID-based ID generation with type safety for different entity types.

### Features

- **Type-Safe IDs**: Branded types for different entities (RunId, NodeId, UserId)
- **ULID Generation**: Universally unique, lexicographically sortable identifiers
- **Validation**: Built-in validation for ULID format
- **Conversion**: Safe conversion from strings to typed IDs

### Usage

```typescript
import {
  newRunId,
  newUserId,
  newNodeId,
  isId,
  isRunId,
  toRunId,
  type RunId,
  type UserId,
} from '@bharat-agents/shared';

// Generate typed IDs
const runId: RunId = newRunId();
const userId: UserId = newUserId();
const nodeId = newNodeId();

// Validate IDs
console.log(isId(runId)); // true
console.log(isRunId(runId)); // true

// Safe conversion
const convertedId = toRunId('01H8Z9K2P3Q4R5S6T7U8V9W0X');
if (convertedId) {
  // Use the typed ID
  console.log(convertedId);
}
```

## Role-Based Access Control (RBAC)

JWT-based authentication and authorization middleware with role-based access control.

### Features

- **JWT Verification**: Secure JWT token verification using jose library
- **Role-Based Authorization**: Middleware for requiring specific roles
- **Development Support**: Optional insecure mode for development
- **Type Safety**: Typed request objects with user information

### Usage

```typescript
import {
  requireRole,
  requireAdmin,
  requireUser,
  requireService,
  optionalAuth,
  type AuthenticatedRequest,
} from '@bharat-agents/shared';
import express from 'express';

const app = express();

// Require specific roles
app.use('/admin', requireAdmin);
app.use('/api', requireUser);
app.use('/service', requireService);

// Custom role requirements
app.use('/premium', requireRole(['admin', 'premium']));

// Optional authentication
app.use('/public', optionalAuth);

// Access user info in route handlers
app.get('/profile', requireUser, (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  const userRoles = req.user?.roles;
  res.json({ userId, userRoles });
});
```

### JWT Payload Structure

```typescript
interface JWTPayload {
  sub: string; // User ID
  roles: Role[]; // User roles
  iat: number; // Issued at
  exp: number; // Expiration
}
```

## Metrics & Monitoring

Prometheus metrics collection and OpenTelemetry integration for observability.

### Features

- **HTTP Metrics**: Request counts, durations, and status codes
- **Agent Metrics**: Run counts, durations, and status tracking
- **LLM Metrics**: Token usage and cost tracking
- **OpenTelemetry**: Distributed tracing and metrics export
- **Express Integration**: Automatic HTTP metrics collection

### Usage

```typescript
import {
  recordAgentRun,
  recordLLMTokens,
  recordLLMCost,
  observeHttp,
  initializeMetrics,
  getMetrics,
} from '@bharat-agents/shared';
import express from 'express';

const app = express();

// Initialize metrics
initializeMetrics();

// Add HTTP metrics collection
observeHttp(app);

// Record custom metrics
recordAgentRun('web-scraper', 'success', 2.5);
recordLLMTokens('openai', 'gpt-4', 'input', 1000);
recordLLMCost('openai', 'gpt-4', 0.06);

// Expose metrics endpoint
app.get('/metrics', async (req, res) => {
  const metrics = await getMetrics();
  res.set('Content-Type', 'text/plain');
  res.send(metrics);
});
```

### Available Metrics

- `http_requests_total`: Total HTTP requests by method, path, and status
- `http_request_duration_seconds`: HTTP request duration histogram
- `agent_runs_total`: Agent run counts by agent and status
- `agent_run_duration_seconds`: Agent run duration histogram
- `llm_tokens_total`: LLM token usage by provider, model, and type
- `llm_cost_usd_total`: LLM costs by provider and model

## Cost Tracking

LLM cost calculation and tracking for multiple providers with real-time pricing.

### Features

- **Multi-Provider Support**: OpenAI, Anthropic, and Groq pricing
- **Real-Time Calculation**: Accurate cost calculation based on token usage
- **Metrics Integration**: Automatic cost tracking in Prometheus metrics
- **Cost Estimation**: Rough cost estimation for text strings

### Usage

```typescript
import {
  trackLLMCost,
  calculateTotalCost,
  getModelPricing,
  getCheapestModel,
  formatCost,
  estimateTextCost,
} from '@bharat-agents/shared';

// Track LLM usage and cost
const cost = trackLLMCost({
  provider: 'openai',
  model: 'gpt-4',
  inputTokens: 1000,
  outputTokens: 500,
});
console.log('Cost:', formatCost(cost)); // $0.060000

// Calculate costs manually
const totalCost = calculateTotalCost(
  'anthropic',
  'claude-3-sonnet',
  2000,
  1000
);

// Get model pricing
const pricing = getModelPricing('openai', 'gpt-4');
console.log(pricing); // { input: 0.03, output: 0.06 }

// Find cheapest model
const cheapest = getCheapestModel('openai');
console.log(cheapest?.model); // gpt-4o-mini

// Estimate text cost
const estimatedCost = estimateTextCost(
  'openai',
  'gpt-4',
  'Hello world!',
  'Hi there!'
);
```

### Supported Providers and Models

- **OpenAI**: GPT-4, GPT-4 Turbo, GPT-4o, GPT-3.5 Turbo
- **Anthropic**: Claude 3 Opus, Claude 3 Sonnet, Claude 3 Haiku, Claude 2
- **Groq**: Llama 3.1 models, Mixtral, Gemma

## OpenTelemetry Integration

Distributed tracing and metrics export using OpenTelemetry.

### Features

- **Auto-Instrumentation**: Automatic HTTP and Express instrumentation
- **OTLP Export**: Export to OpenTelemetry Protocol endpoints
- **Resource Attributes**: Service name, version, and environment
- **Graceful Shutdown**: Proper cleanup on application shutdown

### Usage

```typescript
import { startTelemetry, shutdownTelemetry } from '@bharat-agents/shared';

// In your application startup
async function startApp() {
  // Start telemetry before other services
  await startTelemetry();

  // Start your application
  app.listen(3000);
}

// In your application shutdown
async function shutdownApp() {
  // Shutdown telemetry after other services
  await shutdownTelemetry();
}

// Handle graceful shutdown
process.on('SIGTERM', shutdownApp);
process.on('SIGINT', shutdownApp);
```

## Security Features

- **Environment Validation**: All environment variables are validated at startup
- **Sensitive Data Redaction**: Automatic redaction of passwords, tokens, and keys in logs
- **Type Safety**: Full TypeScript support with strict typing
- **Error Sanitization**: Production-safe error messages without stack traces
- **JWT Security**: Secure JWT verification with configurable issuer and audience
- **Role-Based Access**: Fine-grained access control with role-based permissions

## Contributing

1. Follow the existing code style and patterns
2. Add tests for new functionality
3. Update documentation for any API changes
4. Ensure all tests pass before submitting a PR
