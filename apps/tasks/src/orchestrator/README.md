# Jarvis Orchestrator

The Jarvis Orchestrator is a sophisticated agent execution system that manages the lifecycle of AI agent runs with advanced features including intelligent agent selection, resource limits, timeouts, async job processing, and RBAC enforcement.

## Features

### 🧠 Intelligent Agent Selection

- **Heuristic-based routing**: Automatically selects the appropriate agent based on input content
- **Keyword detection**: Identifies browser-related keywords (`open`, `click`, `visit`, `navigate`, etc.)
- **Fallback logic**: Defaults to GEN agent for text generation tasks
- **Manual override**: Supports explicit agent specification in requests

### ⚡ Per-Run Limits & Timeouts

- **LLM call limits**: Configurable maximum LLM calls per run (default: 10)
- **Browser step limits**: Configurable maximum browser automation steps per run (default: 50)
- **Node timeouts**: Per-node execution timeout (default: 30s)
- **Run timeouts**: Overall run timeout (default: 5m)
- **Automatic cancellation**: Work is cancelled if timeouts are exceeded

### 🔄 Async Job Processing

- **Queue integration**: Heavy work can be queued using BullMQ
- **Environment toggle**: Controlled via `ASYNC_JOBS` environment variable
- **Dual queue system**: Separate queues for agent and browser operations
- **Job persistence**: Jobs are persisted with retry logic and backoff

### 📊 Metrics & Monitoring

- **Agent run metrics**: `agent_runs_total{agent,status}` counter
- **Duration tracking**: Histograms for run and node execution times
- **Queue metrics**: Job processing statistics
- **Prometheus integration**: All metrics exposed in Prometheus format

### 🔐 RBAC Enforcement

- **User isolation**: Users can only access their own runs
- **JWT integration**: User ID extracted from JWT tokens
- **Metadata persistence**: User ID stored in run metadata
- **Access control**: Enforced on all read operations

## Architecture

### Core Components

1. **JarvisOrchestrator**: Main orchestrator class managing run lifecycle
2. **AgentHandlerFactory**: Factory pattern for agent handler registration
3. **Agent Handlers**: Specialized handlers for each agent type
4. **InMemoryStorage**: Storage layer with RBAC enforcement
5. **Queue Integration**: BullMQ integration for async processing

### Agent Types

- **ECHO**: Simple echo agent for testing (returns input as output)
- **BROWSER**: Browser automation agent with step limits
- **GEN**: Text generation agent with LLM call limits

## API Usage

### Creating a Run

```typescript
// Automatic agent selection
const result = await jarvis.handleCreateRun({
  userId: 'user123',
  input: {
    prompt: 'Open google.com and click the search button',
  },
});

// Explicit agent selection
const result = await jarvis.handleCreateRun({
  userId: 'user123',
  input: {
    prompt: 'Generate a story about a cat',
  },
  agent: AgentKind.GEN,
  options: {
    timeout: 60000,
    priority: 'high',
    tags: ['story', 'creative'],
  },
});
```

### Agent Selection Heuristics

The system automatically selects agents based on input content:

```typescript
// Browser keywords trigger BROWSER agent
'open google.com' → BROWSER
'click the button' → BROWSER
'visit the website' → BROWSER
'navigate to page' → BROWSER

// Default to GEN agent for text generation
'write a story' → GEN
'generate content' → GEN
'summarize text' → GEN
```

## Environment Configuration

```bash
# Agent orchestration settings
ASYNC_JOBS=false                    # Enable async job processing
AGENT_NODE_TIMEOUT_MS=30000         # Node execution timeout (30s)
AGENT_RUN_TIMEOUT_MS=300000         # Run execution timeout (5m)
MAX_LLM_CALLS_PER_RUN=10           # Max LLM calls per run
MAX_BROWSER_STEPS_PER_RUN=50       # Max browser steps per run
AGENT_QUEUE_CONCURRENCY=5          # Agent queue concurrency
BROWSER_QUEUE_CONCURRENCY=2        # Browser queue concurrency
```

## REST API Endpoints

### Create Run

```http
POST /v1/runs
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "input": {
    "prompt": "Open google.com and search for AI"
  },
  "agent": "BROWSER",  // Optional
  "options": {
    "timeout": 60000,
    "priority": "normal",
    "tags": ["web", "search"]
  }
}
```

### Get Run

```http
GET /v1/runs/:runId
Authorization: Bearer <jwt-token>
```

### List Runs

```http
GET /v1/runs?limit=100&agent=browser
Authorization: Bearer <jwt-token>
```

### Get Supported Agents

```http
GET /v1/runs/agents/supported
Authorization: Bearer <jwt-token>
```

### Get Run Limits

```http
GET /v1/runs/limits
Authorization: Bearer <jwt-token>
```

## Metrics

### Agent Run Metrics

- `agent_runs_total{agent,status}` - Total agent runs by agent type and status
- `agent_run_duration_seconds{agent}` - Run duration histogram
- `agent_node_duration_seconds{agent,node_type}` - Node execution duration

### Queue Metrics

- `queue_job_total{queue,status}` - Queue job counts
- `queue_job_duration_seconds{queue}` - Job processing duration

## Security

### RBAC Implementation

- **Authentication**: JWT token validation
- **Authorization**: User-based access control
- **Data isolation**: Users can only access their own runs
- **Audit logging**: All access attempts are logged

### Input Validation

- **Agent validation**: Only supported agents are accepted
- **Input sanitization**: All inputs are sanitized
- **Size limits**: Request size limits enforced
- **Timeout protection**: Prevents resource exhaustion

## Error Handling

### Timeout Errors

```typescript
// Node timeout exceeded
{
  code: 'EXECUTION_ERROR',
  message: 'Node execution timeout: 30000ms'
}

// Run timeout exceeded
{
  code: 'EXECUTION_ERROR',
  message: 'Run execution timeout: 300000ms'
}
```

### Limit Exceeded Errors

```typescript
// LLM call limit exceeded
{
  code: 'EXECUTION_ERROR',
  message: 'LLM call limit exceeded: 10'
}

// Browser step limit exceeded
{
  code: 'EXECUTION_ERROR',
  message: 'Browser step limit exceeded: 50'
}
```

### Access Control Errors

```typescript
// Unauthorized access
{
  code: 'ACCESS_DENIED',
  message: 'Access denied: You can only access your own runs'
}
```

## Testing

Run the comprehensive test suite:

```bash
npm test -- orchestrator/jarvis.test.ts
```

Tests cover:

- Agent selection heuristics
- RBAC enforcement
- Agent handler execution
- Timeout handling
- Limit enforcement
- Error scenarios

## Future Enhancements

### Phase 1 Improvements

- **Database persistence**: Replace in-memory storage with PostgreSQL
- **Real agent implementations**: Replace stubs with actual LLM and browser automation
- **Advanced queuing**: Priority queues and job scheduling
- **Distributed execution**: Multi-node agent execution

### Phase 2 Features

- **Agent chaining**: Multi-agent workflows
- **Streaming responses**: Real-time output streaming
- **Advanced monitoring**: Distributed tracing and APM integration
- **Plugin system**: Extensible agent architecture

## Contributing

When contributing to the Jarvis Orchestrator:

1. **Follow the architecture**: Maintain separation of concerns
2. **Add tests**: Ensure comprehensive test coverage
3. **Update metrics**: Add relevant metrics for new features
4. **Document changes**: Update this README for new features
5. **Security first**: Always consider security implications

## License

This project is licensed under the MIT License - see the LICENSE file for details.
