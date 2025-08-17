# Tasks Service

The Tasks service is a core component of the Bharat Agents platform that handles task execution and orchestration.

## Features

- **Task Creation**: Create and execute tasks with various agents
- **Agent Orchestration**: Route tasks to appropriate agents via Jarvis orchestrator
- **Database Persistence**: Store runs, nodes, and artifacts in PostgreSQL
- **Idempotency Support**: Prevent duplicate charges and runs with idempotency keys
- **Security**: JWT authentication and RBAC
- **Monitoring**: Health checks, metrics, and structured logging
- **Queue System**: Background processing with BullMQ and Redis

## API Endpoints

### POST /v1/tasks/create

Create a new task execution.

**Request Body:**

```json
{
  "agent": "echo", // Optional: agent to use (defaults to "echo")
  "input": "Hello, world!", // Required: input for the task
  "meta": {
    // Optional: additional metadata
    "source": "api",
    "priority": "high"
  }
}
```

**Headers:**

- `Idempotency-Key` (optional): Unique key to prevent duplicate runs

**Response:**

```json
{
  "runId": "clx1234567890",
  "status": "COMPLETED",
  "agent": "echo",
  "input": "Hello, world!",
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

### Health Endpoints

- `GET /health` - Application health check
- `GET /ready` - Readiness check (database + Redis)
- `GET /metrics` - Prometheus metrics with default and HTTP metrics

## Request Tracking & Logging

### Request IDs

- **Automatic Generation**: ULID-based request IDs generated automatically
- **Header Support**: Accepts `X-Request-ID` header from clients
- **Response Headers**: Returns `X-Request-ID` and `X-Trace-ID` in responses
- **Structured Logging**: All logs include request ID for correlation

### Structured Logging

- **pino-http**: HTTP request/response logging with structured JSON
- **Custom Levels**: Automatic log level based on response status
- **Request Serialization**: Includes method, URL, headers, remote address
- **Response Serialization**: Includes status code and response headers

## Monitoring & Metrics

### Prometheus Metrics

- **Default Metrics**: CPU, memory, event loop, garbage collection
- **HTTP Metrics**: Request duration, total requests by method/route/status
- **Task Metrics**: Task creation count, execution duration by agent
- **Database Metrics**: Query duration, active connections
- **Redis Metrics**: Operation count, duration, success/failure rates
- **Idempotency Metrics**: Key operations (check, store, cleanup)
- **Queue Metrics**: Job count, processing duration by queue

### Health Checks

- **Database**: Uses Prisma `$queryRaw('SELECT 1')` for connection test
- **Redis**: Uses `redis.ping()` for connection test
- **Comprehensive**: Both services must be healthy for `/ready` endpoint

## Security Features

### Content Security Policy (CSP)

- **Strict CSP**: Only allows same-origin resources
- **No Inline Scripts**: Prevents XSS via inline scripts
- **No External Resources**: Blocks external scripts, styles, and objects
- **Frame Protection**: Prevents clickjacking attacks
- **Upgrade Insecure Requests**: Forces HTTPS

### CORS Configuration

- **Whitelist Origins**: Only allows specified origins from `CORS_ORIGIN` env var
- **Multiple Origins**: Supports comma-separated list of allowed origins
- **Strict Headers**: Only allows necessary headers
- **Exposed Headers**: Exposes only required response headers

### Input Validation & Sanitization

- **Strict Schema Validation**: Rejects unknown fields in requests
- **XSS Prevention**: Blocks 40+ dangerous HTML patterns
- **Size Limits**: Enforces 10KB input limit
- **Agent Validation**: Only allows known agent types
- **Metadata Validation**: Strict object validation with known fields

### Output Sanitization

- **HTML Entity Encoding**: Prevents XSS in responses
- **Sensitive Field Redaction**: Automatically redacts passwords, tokens, keys
- **Response Validation**: Validates all response data before sending
- **No Raw HTML**: Never echoes raw HTML content

### Rate Limiting

- **Default Limit**: 60 requests per minute per IP
- **Configurable**: Can be adjusted via `RATE_LIMIT_MAX` env var
- **Proxy Support**: Handles X-Forwarded-For headers
- **Error Handling**: Proper 429 responses with retry information

### Request Logging & Redaction

- **Sensitive Header Redaction**: Automatically redacts auth headers
- **No Secrets in Logs**: Ensures passwords, tokens, keys are never logged
- **Structured Logging**: All logs include request context
- **Audit Trail**: Complete request/response logging for security

### Security Configuration Examples

**Environment Variables:**

```bash
# CORS Configuration
CORS_ORIGIN=http://localhost:3000,https://app.example.com

# Rate Limiting
RATE_LIMIT_MAX=100  # requests per minute

# Security Headers (via Helmet)
NODE_ENV=production
```

**CSP Headers (automatically set):**

```
Content-Security-Policy: default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self'; connect-src 'self'; font-src 'self'; object-src 'none'; media-src 'self'; frame-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=()
```

## Error Handling

### Structured Error Responses

All error responses include:

- **traceId**: Request tracing identifier
- **requestId**: Unique request identifier
- **timestamp**: ISO timestamp of error
- **path**: Request path that caused error
- **method**: HTTP method that caused error
- **statusCode**: HTTP status code
- **details**: Additional error context (optional)

### Error Types

- **Validation Errors**: Field-level validation with context
- **Not Found**: Resource not found with ID details
- **Unauthorized**: Authentication failures with reason
- **Forbidden**: Authorization failures with required roles

### Example Error Response

```json
{
  "error": "Validation Error",
  "message": "Invalid Idempotency-Key",
  "traceId": "01HXYZ1234567890ABCDEF",
  "requestId": "01HXYZ1234567890ABCDEF",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/v1/tasks/create",
  "method": "POST",
  "statusCode": 400,
  "details": {
    "message": "Idempotency key must be alphanumeric with hyphens/underscores only"
  }
}
```

## Idempotency

The Tasks service supports idempotency to prevent duplicate charges and runs when clients retry requests.

### How It Works

1. **Client sends request** with `Idempotency-Key` header
2. **Service checks** if the key exists in the database
3. **If key exists**: Returns the existing run (HTTP 200)
4. **If key doesn't exist**: Creates new run and stores the key (HTTP 201)

### Idempotency Key Requirements

- **Format**: Alphanumeric characters, hyphens, and underscores only
- **Length**: 1-255 characters
- **Uniqueness**: Must be unique per request
- **TTL**: Automatically cleaned up after 24 hours

### Example Usage

```bash
# First request
curl -X POST http://localhost:3001/v1/tasks/create \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: my-unique-key-123" \
  -d '{"input": "Hello, world!"}'

# Response: HTTP 201 (Created)
{
  "runId": "clx1234567890",
  "status": "COMPLETED",
  "agent": "echo",
  "input": "Hello, world!",
  "createdAt": "2024-01-01T00:00:00.000Z"
}

# Retry with same key
curl -X POST http://localhost:3001/v1/tasks/create \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: my-unique-key-123" \
  -d '{"input": "Hello, world!"}'

# Response: HTTP 200 (Existing run returned)
{
  "runId": "clx1234567890",  // Same run ID
  "status": "COMPLETED",
  "agent": "echo",
  "input": "Hello, world!",
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

### Error Handling

- **Invalid key format**: HTTP 400 with error message
- **Database errors**: Fail open (allows request to proceed)
- **Cleanup**: Automatic cleanup of expired keys every hour

## Database Schema

### Core Models

- **User**: System users with roles
- **Run**: Task execution records
- **Node**: Individual processing nodes within a run
- **Artifact**: Generated artifacts (files, outputs)
- **Idempotency**: Idempotency key storage

### Key Relationships

- User → Runs (one-to-many)
- Run → Nodes (one-to-many)
- Run → Artifacts (one-to-many)
- Run → Idempotency (one-to-one)

## Development

### Prerequisites

- Node.js 18+
- PostgreSQL 16+
- Redis 7+
- MinIO (for S3-compatible storage)

### Setup

1. **Install dependencies:**

   ```bash
   pnpm install
   ```

2. **Set up environment:**

   ```bash
   cp env.example .env.development.local
   # Edit .env.development.local with your values
   ```

3. **Generate Prisma client:**

   ```bash
   pnpm db:generate
   ```

4. **Run database migrations:**

   ```bash
   pnpm db:push
   ```

5. **Start the service:**
   ```bash
   pnpm dev
   ```

### Testing

```bash
# Run tests
pnpm test

# Run tests with coverage
pnpm test:coverage

# Run tests in watch mode
pnpm test:watch
```

### Database Management

```bash
# Push schema changes
pnpm db:push

# Create migration
pnpm db:migrate

# Open Prisma Studio
pnpm db:studio
```

## Architecture

### Components

1. **Routes**: Express route handlers with validation
2. **Controllers**: Business logic for API endpoints
3. **Services**: Core services (S3, LLM, Idempotency, Cleanup)
4. **Agents**: Task execution agents (EchoAgent, etc.)
5. **Orchestrator**: Jarvis orchestrator for agent routing
6. **Queue**: BullMQ for background processing
7. **Database**: Prisma with PostgreSQL

### Security

- **Authentication**: JWT-based with jose library
- **Authorization**: Role-based access control (RBAC)
- **Input Validation**: Strict Zod schema validation with unknown field rejection
- **Output Sanitization**: HTML entity encoding and sensitive field redaction
- **XSS Prevention**: Comprehensive pattern matching for dangerous content
- **Rate Limiting**: 60 requests/minute per IP in development
- **Security Headers**: Comprehensive Helmet configuration with strict CSP
- **CORS**: Whitelist-based origin validation
- **Request Sanitization**: Input sanitization middleware
- **Logger Redaction**: Automatic redaction of sensitive headers and fields

### Monitoring

- **Logging**: Structured logging with Pino
- **Metrics**: Prometheus metrics endpoint
- **Health Checks**: Application and readiness probes
- **Error Handling**: Centralized error middleware

## Production Considerations

### Idempotency

- **Key Generation**: Use UUIDs or cryptographically secure random strings
- **Key Scope**: Consider scoping keys by user/organization
- **Storage**: Monitor idempotency table size and cleanup performance
- **Failures**: Idempotency failures should not break main functionality

### Performance

- **Database Indexes**: Ensure proper indexing on idempotency keys
- **Connection Pooling**: Configure Prisma connection pool
- **Caching**: Consider Redis caching for frequently accessed data
- **Queue Processing**: Monitor queue performance and worker concurrency

### Security

- **Key Validation**: Strict validation of idempotency key format
- **Rate Limiting**: Implement per-user rate limiting
- **Audit Logging**: Log all idempotency key operations
- **Key Rotation**: Consider key expiration policies

## Troubleshooting

### Common Issues

1. **Idempotency key conflicts**: Check for duplicate keys in database
2. **Database connection**: Verify PostgreSQL connection and credentials
3. **Agent failures**: Check agent logs and database for failed runs
4. **Queue issues**: Monitor Redis connection and BullMQ workers

### Debugging

- Enable debug logging: Set `LOG_LEVEL=debug`
- Check database: Use Prisma Studio (`pnpm db:studio`)
- Monitor queues: Check BullMQ dashboard
- View metrics: Access `/metrics` endpoint

## Contributing

1. Follow TypeScript best practices
2. Add tests for new features
3. Update documentation
4. Ensure idempotency for state-changing operations
5. Follow security guidelines
