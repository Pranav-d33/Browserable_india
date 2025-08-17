# Audit Service

The audit service provides comprehensive logging and tracking capabilities for the tasks application. It records events, actions, and their outcomes with support for sensitive data redaction, large payload truncation, and efficient querying.

## Features

- **Event Recording**: Record audit events with payload and result data
- **Secret Redaction**: Automatically redact sensitive information (passwords, API keys, tokens)
- **Data Truncation**: Handle large payloads by truncating while preserving structure
- **Cursor-based Pagination**: Efficient pagination for large audit log datasets
- **RBAC Support**: Role-based access control for audit log retrieval
- **Statistics**: Get audit statistics and metrics for runs
- **Error Resilience**: Audit failures don't break main application flow

## Core Functions

### `record(event: AuditEvent)`

Records an audit event in the database.

```typescript
interface AuditEvent {
  runId: string;
  nodeId?: string;
  userId?: string;
  action: string;
  payload?: any;
  result?: any;
  status: 'OK' | 'ERR';
  durationMs: number;
}
```

**Example:**

```typescript
import { record } from './audit.js';

await record({
  runId: 'run-123',
  nodeId: 'node-456',
  action: 'llm_completion',
  payload: { model: 'gpt-3.5-turbo', prompt: 'Hello world' },
  result: { text: 'Hello! How can I help you?', tokens: 10 },
  status: 'OK',
  durationMs: 1500,
});
```

### `getAuditLogs(runId: string, cursor?: string, limit?: number)`

Retrieves audit logs for a specific run with cursor-based pagination.

**Returns:**

```typescript
{
  logs: Array<{
    id: string;
    runId: string;
    nodeId?: string;
    userId?: string;
    action: string;
    status: string;
    durationMs: number;
    payload?: any;
    result?: any;
    createdAt: Date;
  }>;
  nextCursor?: string;
  hasMore: boolean;
}
```

**Example:**

```typescript
import { getAuditLogs } from './audit.js';

const result = await getAuditLogs('run-123', undefined, 50);
console.log(`Retrieved ${result.logs.length} logs`);
console.log(`Has more: ${result.hasMore}`);
console.log(`Next cursor: ${result.nextCursor}`);
```

### `getAuditStats(runId: string)`

Gets audit statistics for a specific run.

**Returns:**

```typescript
{
  totalEvents: number;
  successCount: number;
  errorCount: number;
  averageDuration: number;
  actions: Array<{ action: string; count: number }>;
}
```

**Example:**

```typescript
import { getAuditStats } from './audit.js';

const stats = await getAuditStats('run-123');
console.log(`Total events: ${stats.totalEvents}`);
console.log(
  `Success rate: ${((stats.successCount / stats.totalEvents) * 100).toFixed(1)}%`
);
console.log(`Average duration: ${stats.averageDuration}ms`);
```

## Secret Redaction

The audit service automatically redacts sensitive information from payloads and results. The following patterns are redacted:

- `password`: `"password": "secret123"` → `"password": "[REDACTED]"`
- `api_key`: `"api_key": "sk-1234567890"` → `"api_key": "[REDACTED]"`
- `secret`: `"secret": "confidential"` → `"secret": "[REDACTED]"`
- `token`: `"token": "jwt-token-here"` → `"token": "[REDACTED]"`
- `key`: `"key": "sensitive-key"` → `"key": "[REDACTED]"`

**Example:**

```typescript
const event = {
  runId: 'run-123',
  action: 'api_call',
  payload: {
    endpoint: '/api/data',
    headers: {
      Authorization: 'Bearer sk-1234567890',
      'Content-Type': 'application/json',
    },
    body: {
      username: 'testuser',
      password: 'secretpassword',
    },
  },
  status: 'OK',
  durationMs: 500,
};

// The password and API key will be automatically redacted
await record(event);
```

## Data Truncation

Large payloads and results are automatically truncated to prevent database issues. The maximum size is 1MB per JSONB field.

**Truncation Strategies:**

- **Arrays**: Keep first 10 items, add truncation metadata
- **Objects**: Truncate individual fields that are too large
- **Strings**: Provide preview with truncation metadata

**Example:**

```typescript
const largeArray = new Array(100000).fill('data');
const event = {
  runId: 'run-123',
  action: 'data_processing',
  payload: largeArray,
  status: 'OK',
  durationMs: 1000,
};

// The array will be truncated to first 10 items with metadata
await record(event);
```

## API Endpoints

### `GET /v1/runs/:id/logs`

Retrieves audit logs for a specific run with RBAC protection.

**Query Parameters:**

- `cursor` (optional): Cursor for pagination
- `limit` (optional): Number of logs to retrieve (default: 50, max: 100)

**Response:**

```json
{
  "data": {
    "logs": [
      {
        "id": "log-123",
        "runId": "run-456",
        "nodeId": "node-789",
        "userId": "user-123",
        "action": "llm_completion",
        "status": "OK",
        "durationMs": 1500,
        "payload": { "model": "gpt-3.5-turbo" },
        "result": { "text": "Hello world" },
        "createdAt": "2023-01-01T00:00:00.000Z"
      }
    ],
    "stats": {
      "totalEvents": 100,
      "successCount": 85,
      "errorCount": 15,
      "averageDuration": 1200,
      "actions": [
        { "action": "llm_completion", "count": 50 },
        { "action": "browser_action", "count": 30 }
      ]
    },
    "pagination": {
      "nextCursor": "log-456",
      "hasMore": true
    }
  }
}
```

**RBAC Requirements:**

- Only the run owner or administrators can access audit logs
- Requires authentication
- Returns 403 Forbidden for unauthorized access

## Database Schema

The audit service uses the `AuditLog` table with the following schema:

```sql
CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  node_id TEXT,
  user_id TEXT,
  action TEXT NOT NULL,
  status TEXT NOT NULL,
  duration_ms INTEGER NOT NULL,
  payload JSONB,
  result JSONB,
  created_at TIMESTAMP DEFAULT NOW(),

  FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE CASCADE
);

-- Indexes for efficient querying
CREATE INDEX idx_audit_logs_run_created ON audit_logs(run_id, created_at);
CREATE INDEX idx_audit_logs_user_created ON audit_logs(user_id, created_at);
CREATE INDEX idx_audit_logs_action_created ON audit_logs(action, created_at);
CREATE INDEX idx_audit_logs_status_created ON audit_logs(status, created_at);
```

## Integration Examples

### Function Wrapper

```typescript
async function auditedFunction<T>(
  runId: string,
  action: string,
  fn: () => Promise<T>
): Promise<T> {
  const startTime = Date.now();

  try {
    const result = await fn();

    await record({
      runId,
      action,
      status: 'OK',
      durationMs: Date.now() - startTime,
      result: { success: true, data: result },
    });

    return result;
  } catch (error) {
    await record({
      runId,
      action,
      status: 'ERR',
      durationMs: Date.now() - startTime,
      result: {
        error: error instanceof Error ? error.message : String(error),
        success: false,
      },
    });

    throw error;
  }
}

// Usage
const result = await auditedFunction('run-123', 'api_call', async () => {
  return await fetch('/api/data');
});
```

### Browser Client Integration

```typescript
import { record } from './audit.js';

class BrowserClient {
  async createSession() {
    const startTime = Date.now();

    try {
      const session = await this.makeRequest('POST', '/sessions');

      await record({
        runId: this.runId,
        action: 'browser_session_created',
        status: 'OK',
        durationMs: Date.now() - startTime,
        result: { sessionId: session.id },
      });

      return session;
    } catch (error) {
      await record({
        runId: this.runId,
        action: 'browser_session_created',
        status: 'ERR',
        durationMs: Date.now() - startTime,
        result: { error: error.message },
      });

      throw error;
    }
  }
}
```

## Error Handling

The audit service is designed to be resilient:

- **Non-blocking**: Audit failures don't break the main application flow
- **Graceful degradation**: If the database is unavailable, audit events are logged but not thrown
- **Error logging**: All audit errors are logged for debugging

## Performance Considerations

- **Async operations**: All database operations are asynchronous
- **Indexed queries**: Database indexes optimize audit log retrieval
- **Cursor pagination**: Efficient for large datasets
- **Data truncation**: Prevents database performance issues from large payloads
- **Connection pooling**: Uses Prisma's connection pooling

## Security

- **Secret redaction**: Automatic redaction of sensitive data
- **RBAC**: Role-based access control for audit log retrieval
- **Input validation**: All inputs are validated before processing
- **SQL injection protection**: Uses Prisma ORM for safe database operations

## Testing

Run the test suite:

```bash
# Run all audit tests
npx vitest run src/services/audit.test.ts

# Run simple tests
npx vitest run src/services/audit.simple.test.ts
```

## Examples

See `audit.example.ts` for comprehensive usage examples including:

- Basic event recording
- Payload and result handling
- Secret redaction
- Error events
- Large payload truncation
- Integration patterns
