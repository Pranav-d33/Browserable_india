# Agents

The agents module provides a framework for executing automated tasks with different capabilities. Each agent extends the `BaseAgent` class and implements specific functionality for different types of automation.

## Architecture

### BaseAgent

The `BaseAgent` class provides common functionality for all agents:

- **Abstract interface**: Defines the contract for all agents
- **Common helpers**: Shared utilities for LLM integration and artifact storage
- **Audit logging**: Built-in audit trail for all agent actions
- **Error handling**: Consistent error handling across all agents

### Agent Types

Currently implemented agents:

1. **BrowserAgent**: Web automation and scraping
2. **GenerativeAgent**: LLM-based text and JSON generation
3. **EchoAgent**: Simple echo/response agent (for testing)

## BaseAgent Features

### `safeLLMJson<T>(prompt, schema, runId, nodeId?)`

Safely parse JSON from LLM responses using Zod schemas:

```typescript
import { z } from 'zod';

const UserSchema = z.object({
  name: z.string(),
  email: z.string().email(),
  age: z.number().min(0),
});

const user = await this.safeLLMJson(
  'Extract user information from this text: John Doe, john@example.com, 30 years old',
  UserSchema,
  'run-123',
  'node-456'
);
// Returns: { name: 'John Doe', email: 'john@example.com', age: 30 }
```

### `storeArtifact(options)`

Store files (screenshots, PDFs, etc.) to S3/MinIO:

```typescript
const artifactUrl = await this.storeArtifact({
  runId: 'run-123',
  buffer: screenshotBuffer,
  mime: 'image/png',
  ext: 'png',
  metadata: { type: 'screenshot', page: 'homepage' },
});
// Returns: 'https://artifacts.example.com/run-123/1234567890-abc123.png'
```

### `recordAction(runId, nodeId, action, payload?, result?, status?, durationMs?)`

Record audit logs for agent actions:

```typescript
await this.recordAction(
  'run-123',
  'node-456',
  'browser_navigation',
  { url: 'https://example.com' },
  { success: true, title: 'Example Page' },
  'OK',
  1500
);
```

## BrowserAgent

The `BrowserAgent` handles web automation and scraping tasks with LLM-powered step generation.

### Features

- **LLM Step Generation**: Convert natural language instructions into browser steps
- **Robust Error Handling**: Automatic retries and graceful error recovery
- **Data Extraction**: Extract structured data from web pages
- **Screenshot Capture**: Automatic screenshots for debugging and documentation
- **Session Management**: Automatic session cleanup with keep-alive option
- **Audit Logging**: Comprehensive audit trail for all browser actions

### Input Schema

```typescript
interface BrowserInput {
  instructions: string; // Natural language instructions
  steps?: BrowserStep[]; // Optional pre-defined steps
  keepAlive?: boolean; // Keep session alive (default: false)
}

interface BrowserStep {
  action: 'goto' | 'click' | 'type' | 'wait' | 'screenshot' | 'extract';
  selector?: string; // CSS selector for element
  text?: string; // Text to type
  url?: string; // URL to navigate to
  wait?: number; // Milliseconds to wait
  extract?: boolean; // Extract data from element
}
```

### Output Schema

```typescript
interface BrowserOutput {
  url?: string; // Final page URL
  title?: string; // Page title
  screenshot?: string; // Screenshot artifact URL
  extractedData?: Record<string, any>; // Extracted data
  steps: BrowserStep[]; // Executed steps
  success: boolean; // Success status
  error?: string; // Error message if failed
}
```

### Usage Examples

#### Basic Navigation

```typescript
import { BrowserAgent } from './agents/browser.js';

const agent = new BrowserAgent();

const result = await agent.runNode({
  runId: 'run-123',
  nodeId: 'node-456',
  input: JSON.stringify({
    instructions: 'Go to example.com and take a screenshot',
    steps: [
      { action: 'goto', url: 'https://example.com' },
      { action: 'wait', wait: 2000 },
      { action: 'screenshot' },
    ],
  }),
});

console.log(result.output); // JSON string with results
console.log(result.artifacts); // Array of artifact URLs
```

#### LLM-Generated Steps

```typescript
const result = await agent.runNode({
  runId: 'run-123',
  nodeId: 'node-456',
  input: JSON.stringify({
    instructions:
      'Go to example.com, click the login button, and extract the page title',
    // No steps provided - LLM will generate them
  }),
});
```

#### Data Extraction

```typescript
const result = await agent.runNode({
  runId: 'run-123',
  nodeId: 'node-456',
  input: JSON.stringify({
    instructions: 'Extract user profile information',
    steps: [
      { action: 'goto', url: 'https://example.com/profile' },
      { action: 'wait', wait: 1000 },
      { action: 'extract', selector: '.user-name', extract: true },
      { action: 'extract', selector: '.user-email', extract: true },
      { action: 'extract', selector: '.user-bio', extract: true },
    ],
  }),
});

const output = JSON.parse(result.output);
console.log(output.extractedData);
// {
//   '.user-name': 'John Doe',
//   '.user-email': 'john@example.com',
//   '.user-bio': 'Software developer...'
// }
```

#### Form Interaction

```typescript
const result = await agent.runNode({
  runId: 'run-123',
  nodeId: 'node-456',
  input: JSON.stringify({
    instructions: 'Fill out and submit a contact form',
    steps: [
      { action: 'goto', url: 'https://example.com/contact' },
      { action: 'wait', wait: 1000 },
      { action: 'type', selector: 'input[name="name"]', text: 'John Doe' },
      {
        action: 'type',
        selector: 'input[name="email"]',
        text: 'john@example.com',
      },
      { action: 'type', selector: 'textarea[name="message"]', text: 'Hello!' },
      { action: 'click', selector: 'button[type="submit"]' },
      { action: 'wait', wait: 2000 },
      { action: 'screenshot' },
    ],
  }),
});
```

### Environment Configuration

```bash
# Browser automation limits
export BROWSER_MAX_STEPS=30              # Maximum steps per automation
export BROWSER_MAX_DURATION_MS=90000     # Maximum duration (90 seconds)

# Service URLs
export BROWSER_SERVICE_URL=http://localhost:3001
export ARTIFACT_BASE_URL=http://localhost:3000/artifacts

# LLM configuration
export LLM_PROVIDER=openai
export LLM_MODEL=gpt-3.5-turbo
export OPENAI_API_KEY=your-api-key
```

### Browser Actions

| Action       | Description     | Required Fields    | Optional Fields     |
| ------------ | --------------- | ------------------ | ------------------- |
| `goto`       | Navigate to URL | `url`              | -                   |
| `click`      | Click element   | `selector`         | -                   |
| `type`       | Type text       | `selector`, `text` | -                   |
| `wait`       | Wait for time   | -                  | `wait` (ms)         |
| `screenshot` | Take screenshot | -                  | -                   |
| `extract`    | Extract data    | `selector`         | `extract` (boolean) |

### Error Handling

The BrowserAgent includes comprehensive error handling:

- **Network Errors**: Automatic retries with exponential backoff
- **Element Not Found**: Graceful handling with detailed error messages
- **Timeouts**: Configurable timeouts for slow-loading pages
- **Session Cleanup**: Automatic cleanup even on errors
- **Audit Logging**: All errors are logged for debugging

### Performance Considerations

- **Session Reuse**: Sessions can be kept alive for multiple operations
- **Parallel Execution**: Multiple browser agents can run concurrently
- **Resource Management**: Automatic cleanup of browser resources
- **Caching**: Screenshots and artifacts are cached for efficiency

## GenerativeAgent

The `GenerativeAgent` handles LLM-based text and JSON generation with robust schema validation and cost tracking.

### Features

- **Text Generation**: Generate creative content, stories, and explanations
- **JSON Generation**: Create structured data with optional schema validation
- **Schema Validation**: Robust two-attempt retry with schema fix prompts
- **Cost Tracking**: Automatic token counting and cost calculation
- **Metadata Persistence**: Store generation metadata in Run records
- **Audit Logging**: Comprehensive audit trail for all generation attempts

### Input Schema

```typescript
interface GenerativeInput {
  instructions: string; // Natural language instructions
  format?: 'text' | 'json'; // Output format (default: 'text')
  schema?: string; // Zod schema definition as string (optional)
}
```

### Output Schema

```typescript
interface GenerativeOutput {
  text: string; // Generated text or JSON string
  inputTokens: number; // Input token count
  outputTokens: number; // Output token count
  cost: number; // Calculated cost
  format: 'text' | 'json'; // Output format
  schema?: string; // Applied schema (if any)
  success: boolean; // Success status
  error?: string; // Error message if failed
}
```

### Usage Examples

#### Basic Text Generation

```typescript
import { GenerativeAgent } from './agents/generative.js';

const agent = new GenerativeAgent();

const result = await agent.runNode({
  runId: 'run-123',
  nodeId: 'node-456',
  input: JSON.stringify({
    instructions: 'Write a short story about a robot learning to paint',
    format: 'text',
  }),
});

console.log(result.output); // JSON string with generated text
console.log(result.meta?.cost); // Cost of generation
```

#### JSON Generation Without Schema

```typescript
const result = await agent.runNode({
  runId: 'run-123',
  nodeId: 'node-456',
  input: JSON.stringify({
    instructions: 'Create a user profile with name, email, and preferences',
    format: 'json',
  }),
});

const output = JSON.parse(result.output);
console.log(output.text); // JSON string
```

#### JSON Generation With Schema Validation

```typescript
const result = await agent.runNode({
  runId: 'run-123',
  nodeId: 'node-456',
  input: JSON.stringify({
    instructions: 'Create a product listing',
    format: 'json',
    schema:
      'z.object({ name: z.string(), price: z.number(), category: z.string(), inStock: z.boolean() })',
  }),
});

const output = JSON.parse(result.output);
console.log(output.text); // Validated JSON string
```

#### Complex Schema with Nested Objects

```typescript
const result = await agent.runNode({
  runId: 'run-123',
  nodeId: 'node-456',
  input: JSON.stringify({
    instructions: 'Create a detailed user profile with address and preferences',
    format: 'json',
    schema: `z.object({
      name: z.string(),
      email: z.string().email(),
      age: z.number().min(0),
      address: z.object({
        street: z.string(),
        city: z.string(),
        country: z.string(),
        zipCode: z.string()
      }),
      preferences: z.object({
        theme: z.enum(['light', 'dark']),
        notifications: z.boolean(),
        language: z.string()
      })
    })`,
  }),
});
```

### Environment Configuration

```bash
# LLM configuration
export LLM_PROVIDER=openai
export LLM_MODEL=gpt-3.5-turbo
export OPENAI_API_KEY=your-api-key

# Cost tracking
export ENABLE_COST_TRACKING=true
```

### Schema Validation and Retry Logic

The GenerativeAgent includes robust schema validation:

1. **Schema Parsing**: Automatically parse Zod schema from string
2. **Two-Attempt Retry**: Try up to 2 times for JSON generation
3. **Schema Fix Prompts**: On validation failure, retry with explicit schema instructions
4. **JSON Extraction**: Handle JSON wrapped in markdown or other text
5. **Error Recovery**: Graceful handling of schema parsing errors

### Cost Tracking

The agent automatically tracks:

- **Input/Output Tokens**: Count tokens for cost calculation
- **Cost Calculation**: Use `trackLLMCost` utility for accurate pricing
- **Metadata Storage**: Persist cost data in Run metadata
- **Audit Logging**: Log all cost-related information

### Error Handling

The GenerativeAgent handles various error scenarios:

- **Schema Errors**: Invalid schema syntax and parsing failures
- **LLM Errors**: Service unavailability and rate limiting
- **JSON Errors**: Invalid JSON responses and validation failures
- **Retry Logic**: Automatic retries with improved prompts
- **Graceful Degradation**: Error reporting without breaking execution

### Performance Considerations

- **Deterministic Settings**: Low temperature for consistent JSON output
- **Token Limits**: Configurable max tokens for cost control
- **Parallel Execution**: Multiple agents can run concurrently
- **Caching**: LLM responses can be cached for efficiency

#### Data Extraction

```typescript
const result = await agent.runNode({
  runId: 'run-123',
  nodeId: 'node-456',
  input: JSON.stringify({
    instructions: 'Extract user profile information',
    steps: [
      { action: 'goto', url: 'https://example.com/profile' },
      { action: 'wait', wait: 1000 },
      { action: 'extract', selector: '.user-name', extract: true },
      { action: 'extract', selector: '.user-email', extract: true },
      { action: 'extract', selector: '.user-bio', extract: true },
    ],
  }),
});

const output = JSON.parse(result.output);
console.log(output.extractedData);
// {
//   '.user-name': 'John Doe',
//   '.user-email': 'john@example.com',
//   '.user-bio': 'Software developer...'
// }
```

#### Form Interaction

```typescript
const result = await agent.runNode({
  runId: 'run-123',
  nodeId: 'node-456',
  input: JSON.stringify({
    instructions: 'Fill out and submit a contact form',
    steps: [
      { action: 'goto', url: 'https://example.com/contact' },
      { action: 'wait', wait: 1000 },
      { action: 'type', selector: 'input[name="name"]', text: 'John Doe' },
      {
        action: 'type',
        selector: 'input[name="email"]',
        text: 'john@example.com',
      },
      { action: 'type', selector: 'textarea[name="message"]', text: 'Hello!' },
      { action: 'click', selector: 'button[type="submit"]' },
      { action: 'wait', wait: 2000 },
      { action: 'screenshot' },
    ],
  }),
});
```

### Environment Configuration

```bash
# Browser automation limits
export BROWSER_MAX_STEPS=30              # Maximum steps per automation
export BROWSER_MAX_DURATION_MS=90000     # Maximum duration (90 seconds)

# Service URLs
export BROWSER_SERVICE_URL=http://localhost:3001
export ARTIFACT_BASE_URL=http://localhost:3000/artifacts

# LLM configuration
export LLM_PROVIDER=openai
export LLM_MODEL=gpt-3.5-turbo
export OPENAI_API_KEY=your-api-key
```

### Browser Actions

| Action       | Description     | Required Fields    | Optional Fields     |
| ------------ | --------------- | ------------------ | ------------------- |
| `goto`       | Navigate to URL | `url`              | -                   |
| `click`      | Click element   | `selector`         | -                   |
| `type`       | Type text       | `selector`, `text` | -                   |
| `wait`       | Wait for time   | -                  | `wait` (ms)         |
| `screenshot` | Take screenshot | -                  | -                   |
| `extract`    | Extract data    | `selector`         | `extract` (boolean) |

### Error Handling

The BrowserAgent includes comprehensive error handling:

- **Network Errors**: Automatic retries with exponential backoff
- **Element Not Found**: Graceful handling with detailed error messages
- **Timeouts**: Configurable timeouts for slow-loading pages
- **Session Cleanup**: Automatic cleanup even on errors
- **Audit Logging**: All errors are logged for debugging

### Performance Considerations

- **Session Reuse**: Sessions can be kept alive for multiple operations
- **Parallel Execution**: Multiple browser agents can run concurrently
- **Resource Management**: Automatic cleanup of browser resources
- **Caching**: Screenshots and artifacts are cached for efficiency

## Testing

Run the test suite:

```bash
# Run all agent tests
npx vitest run src/agents/

# Run specific agent tests
npx vitest run src/agents/browser.test.ts
npx vitest run src/agents/browser.simple.test.ts
npx vitest run src/agents/generative.test.ts
npx vitest run src/agents/generative.simple.test.ts

# Run with coverage
npx vitest run --coverage src/agents/
```

## Examples

See the example files for comprehensive usage examples:

- `browser.example.ts` - Browser agent examples
- `generative.example.ts` - Generative agent examples
- `base.example.ts` - Base agent examples

## Integration

### With Task Orchestrator

```typescript
import { BrowserAgent } from './agents/browser.js';

// Register agent with orchestrator
orchestrator.registerAgent('browser', new BrowserAgent());

// Execute browser automation task
const result = await orchestrator.executeTask({
  agent: 'browser',
  input: {
    instructions: 'Scrape product information from e-commerce site',
  },
});
```

### With Audit Service

All agent actions are automatically logged to the audit service:

```typescript
// Audit logs are automatically created for:
// - Agent start/completion
// - Step execution
// - Data extraction
// - Error handling
// - Session management
```

### With Artifact Storage

Screenshots and other artifacts are automatically stored:

```typescript
// Artifacts are stored with metadata:
// - Run ID and node ID
// - Timestamp and file type
// - Size and format information
// - Custom metadata
```

## Security

- **Input Validation**: All inputs are validated using Zod schemas
- **Error Sanitization**: Sensitive information is redacted from error messages
- **Session Isolation**: Each automation runs in its own browser session
- **Resource Limits**: Configurable limits prevent resource exhaustion
- **Audit Trail**: All actions are logged for security monitoring

## Monitoring

The agents provide comprehensive monitoring capabilities:

- **Performance Metrics**: Execution time, step count, success rates
- **Error Tracking**: Detailed error logs with context
- **Resource Usage**: Memory and CPU usage monitoring
- **Audit Logs**: Complete audit trail for compliance
- **Artifact Tracking**: File storage and retrieval metrics
