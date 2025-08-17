# Browser Client

A comprehensive REST client for the browser service that provides browser automation capabilities with robust error handling, retries, timeouts, and audit logging.

## Features

- **Session Management**: Create, close, and list browser sessions
- **Browser Actions**: Navigate, click, type, wait, screenshot, and extract content
- **Zod Validation**: Type-safe request/response validation
- **Retry Logic**: Exponential backoff with jitter for transient failures
- **Request Timeouts**: Configurable timeouts for all operations
- **Audit Logging**: Comprehensive logging of all operations
- **Error Handling**: Graceful handling of various error scenarios
- **Action Polling**: Wait for action completion with timeout support

## Quick Start

### Basic Usage

```typescript
import { createBrowserClient } from './src/services/browserClient';

// Create a browser client
const browserClient = createBrowserClient('http://localhost:3002');

// Create a session
const sessionId = await browserClient.createSession();

// Navigate to a website
const action = await browserClient.goto(sessionId, 'https://example.com');

// Wait for action completion
const completedAction = await browserClient.waitForAction(action.id);

// Close the session
await browserClient.closeSession(sessionId);
```

### With Audit Logging

```typescript
import {
  createBrowserClient,
  ConsoleAuditLogger,
} from './src/services/browserClient';

const auditLogger = new ConsoleAuditLogger();
const browserClient = createBrowserClient(
  'http://localhost:3002',
  { enableAuditLog: true },
  auditLogger
);
```

## API Reference

### Session Management

#### `createSession(): Promise<SessionId>`

Creates a new browser session.

```typescript
const sessionId = await browserClient.createSession();
console.log(`Session created: ${sessionId}`);
```

#### `closeSession(sessionId: SessionId): Promise<void>`

Closes a browser session.

```typescript
await browserClient.closeSession(sessionId);
```

#### `listSessions(): Promise<BrowserSession[]>`

Lists all active browser sessions.

```typescript
const sessions = await browserClient.listSessions();
sessions.forEach(session => {
  console.log(
    `${session.sessionId}: ${session.isActive ? 'Active' : 'Inactive'}`
  );
});
```

### Browser Actions

#### `goto(sessionId: SessionId, url: string, screenshot = false): Promise<BrowserAction>`

Navigates to a URL.

```typescript
const action = await browserClient.goto(sessionId, 'https://example.com', true);
```

#### `click(sessionId: SessionId, url: string, selector: string, screenshot = false): Promise<BrowserAction>`

Clicks on an element.

```typescript
const action = await browserClient.click(
  sessionId,
  'https://example.com',
  '#submit-button'
);
```

#### `type(sessionId: SessionId, url: string, selector: string, text: string, screenshot = false): Promise<BrowserAction>`

Types text into an input field.

```typescript
const action = await browserClient.type(
  sessionId,
  'https://example.com',
  '#search-input',
  'search term'
);
```

#### `waitFor(sessionId: SessionId, url: string, selector?: string, timeout?: number, screenshot = false): Promise<BrowserAction>`

Waits for an element to appear or for a timeout.

```typescript
// Wait for element
const action = await browserClient.waitFor(
  sessionId,
  'https://example.com',
  '#loading-spinner'
);

// Wait for timeout
const action = await browserClient.waitFor(
  sessionId,
  'https://example.com',
  undefined,
  5000
);
```

#### `screenshot(sessionId: SessionId, url: string): Promise<BrowserAction>`

Takes a screenshot of the page.

```typescript
const action = await browserClient.screenshot(sessionId, 'https://example.com');
```

#### `extract(sessionId: SessionId, url: string, selector?: string): Promise<BrowserAction>`

Extracts content from the page.

```typescript
// Extract specific element
const action = await browserClient.extract(
  sessionId,
  'https://example.com',
  '.content'
);

// Extract page title and URL
const action = await browserClient.extract(sessionId, 'https://example.com');
```

#### `executeAction(request: ExecuteActionRequest): Promise<BrowserAction>`

Executes a custom action with full control over parameters.

```typescript
const action = await browserClient.executeAction({
  sessionId,
  type: 'click',
  url: 'https://example.com',
  selector: '#button',
  screenshot: true,
});
```

### Action Management

#### `getAction(actionId: string): Promise<BrowserAction>`

Gets an action by ID.

```typescript
const action = await browserClient.getAction('action-123');
console.log(`Action status: ${action.status}`);
```

#### `getActions(filters?: ActionFilters): Promise<ActionsListResult>`

Gets a list of actions with optional filtering.

```typescript
const result = await browserClient.getActions({
  page: 1,
  limit: 10,
  status: 'completed',
  type: 'navigate',
});

console.log(`Total actions: ${result.pagination.total}`);
result.actions.forEach(action => {
  console.log(`${action.type}: ${action.url}`);
});
```

### Utility Methods

#### `waitForAction(actionId: string, timeout = 60000, pollInterval = 1000): Promise<BrowserAction>`

Waits for an action to complete.

```typescript
const action = await browserClient.waitForAction('action-123', 30000, 500);
if (action.status === 'completed') {
  console.log('Action completed successfully!');
}
```

## Configuration

### Client Configuration

```typescript
const browserClient = createBrowserClient('http://localhost:3002', {
  timeout: 30000, // Request timeout in milliseconds
  retries: 3, // Number of retries for failed requests
  retryDelay: 1000, // Base delay between retries
  enableAuditLog: true, // Enable audit logging
});
```

### Runtime Configuration Updates

```typescript
// Update timeout
browserClient.setConfig({ timeout: 45000 });

// Update retry configuration
browserClient.setRetryConfig({
  maxRetries: 5,
  baseDelay: 2000,
  maxDelay: 15000,
  jitter: true,
});

// Set custom audit logger
browserClient.setAuditLogger(customAuditLogger);
```

## Error Handling

### Retry Logic

The client automatically retries failed requests with exponential backoff and jitter:

- **Exponential Backoff**: Delays increase exponentially (1s, 2s, 4s, etc.)
- **Jitter**: Random variation to prevent thundering herd
- **Non-Retryable Errors**: HTTP 4xx errors are not retried
- **Max Retries**: Configurable retry limit (default: 3)

### Error Types

```typescript
try {
  const action = await browserClient.goto(sessionId, 'https://example.com');
} catch (error) {
  if (error.message.includes('HTTP 400')) {
    // Bad request - don't retry
  } else if (error.message.includes('HTTP 500')) {
    // Server error - will be retried
  } else if (error.message.includes('Network error')) {
    // Network issue - will be retried
  }
}
```

## Audit Logging

### Built-in Audit Logger

```typescript
import { ConsoleAuditLogger } from './src/services/browserClient';

const auditLogger = new ConsoleAuditLogger();
const browserClient = createBrowserClient(
  'http://localhost:3002',
  {},
  auditLogger
);
```

### Custom Audit Logger

```typescript
import type { AuditLogger, AuditLogEntry } from './src/services/browserClient';

class CustomAuditLogger implements AuditLogger {
  async log(entry: AuditLogEntry): Promise<void> {
    // Log to database, external service, etc.
    console.log(
      `[${entry.timestamp.toISOString()}] ${entry.operation}: ${entry.status}`
    );
  }
}

const browserClient = createBrowserClient(
  'http://localhost:3002',
  {},
  new CustomAuditLogger()
);
```

### Audit Log Entry Structure

```typescript
interface AuditLogEntry {
  timestamp: Date;
  operation: string; // 'createSession', 'goto', 'click', etc.
  sessionId?: SessionId; // Session ID if applicable
  actionId?: string; // Action ID if applicable
  url?: string; // URL if applicable
  status: 'success' | 'error';
  duration: number; // Operation duration in milliseconds
  error?: string; // Error message if failed
  metadata?: Record<string, unknown>; // Additional context
}
```

## Examples

### Web Scraping Workflow

```typescript
async function scrapeWebsite() {
  const browserClient = createBrowserClient('http://localhost:3002');
  const sessionId = await browserClient.createSession();

  try {
    // Navigate to website
    const navigateAction = await browserClient.goto(
      sessionId,
      'https://example.com'
    );
    await browserClient.waitForAction(navigateAction.id);

    // Wait for content to load
    const waitAction = await browserClient.waitFor(
      sessionId,
      'https://example.com',
      '.content'
    );
    await browserClient.waitForAction(waitAction.id);

    // Extract content
    const extractAction = await browserClient.extract(
      sessionId,
      'https://example.com',
      '.content'
    );
    const extractResult = await browserClient.waitForAction(extractAction.id);

    if (extractResult.result?.success) {
      console.log('Extracted content:', extractResult.result.data);
    }

    // Take screenshot
    const screenshotAction = await browserClient.screenshot(
      sessionId,
      'https://example.com'
    );
    await browserClient.waitForAction(screenshotAction.id);
  } finally {
    await browserClient.closeSession(sessionId);
  }
}
```

### Form Filling

```typescript
async function fillForm() {
  const browserClient = createBrowserClient('http://localhost:3002');
  const sessionId = await browserClient.createSession();

  try {
    // Navigate to form
    await browserClient.goto(sessionId, 'https://example.com/form');
    await browserClient.waitForAction(
      (await browserClient.goto(sessionId, 'https://example.com/form')).id
    );

    // Fill form fields
    await browserClient.type(
      sessionId,
      'https://example.com/form',
      '#name',
      'John Doe'
    );
    await browserClient.type(
      sessionId,
      'https://example.com/form',
      '#email',
      'john@example.com'
    );

    // Submit form
    await browserClient.click(sessionId, 'https://example.com/form', '#submit');

    // Wait for success message
    await browserClient.waitFor(
      sessionId,
      'https://example.com/form',
      '.success-message'
    );
  } finally {
    await browserClient.closeSession(sessionId);
  }
}
```

### Error Handling

```typescript
async function robustScraping() {
  const browserClient = createBrowserClient('http://localhost:3002', {
    timeout: 60000,
    retries: 5,
    retryDelay: 2000,
  });

  const sessionId = await browserClient.createSession();

  try {
    const action = await browserClient.goto(sessionId, 'https://example.com');

    // Wait with custom timeout
    const completedAction = await browserClient.waitForAction(action.id, 30000);

    if (completedAction.status === 'failed') {
      console.error('Navigation failed:', completedAction.result?.error);
      return;
    }

    console.log('Navigation successful!');
  } catch (error) {
    console.error('Unexpected error:', error);
  } finally {
    try {
      await browserClient.closeSession(sessionId);
    } catch (error) {
      console.error('Error closing session:', error);
    }
  }
}
```

## Environment Configuration

Add the browser service URL to your environment:

```bash
# .env
BROWSER_SERVICE_URL=http://localhost:3002
```

```typescript
import { env } from './src/env';

const browserClient = createBrowserClient(
  env.BROWSER_SERVICE_URL || 'http://localhost:3002'
);
```

## Best Practices

### 1. Always Close Sessions

```typescript
let sessionId: string;
try {
  sessionId = await browserClient.createSession();
  // ... use session
} finally {
  if (sessionId) {
    await browserClient.closeSession(sessionId);
  }
}
```

### 2. Use Appropriate Timeouts

```typescript
// For fast operations
const browserClient = createBrowserClient('http://localhost:3002', {
  timeout: 15000,
});

// For slow operations
const browserClient = createBrowserClient('http://localhost:3002', {
  timeout: 60000,
});
```

### 3. Handle Action Completion

```typescript
const action = await browserClient.goto(sessionId, 'https://example.com');
const completedAction = await browserClient.waitForAction(action.id);

if (completedAction.status === 'failed') {
  throw new Error(`Navigation failed: ${completedAction.result?.error}`);
}
```

### 4. Use Audit Logging in Production

```typescript
const auditLogger = new ConsoleAuditLogger();
const browserClient = createBrowserClient(
  'http://localhost:3002',
  {},
  auditLogger
);
```

### 5. Implement Proper Error Handling

```typescript
try {
  await browserClient.click(sessionId, url, selector);
} catch (error) {
  if (error.message.includes('Element not found')) {
    // Handle missing element
  } else if (error.message.includes('Timeout')) {
    // Handle timeout
  } else {
    // Handle other errors
  }
}
```

## Testing

Run the test suite:

```bash
# Run all browser client tests
pnpm test src/services/browserClient.test.ts

# Run with coverage
pnpm test --coverage src/services/browserClient.test.ts
```

## Troubleshooting

### Common Issues

1. **"Session not found"**: Session may have expired or been closed
2. **"Element not found"**: Selector may be incorrect or element not loaded
3. **"Timeout"**: Page may be slow to load or element not appearing
4. **"Network error"**: Browser service may be unavailable

### Debug Mode

Enable debug logging to see detailed information:

```typescript
const browserClient = createBrowserClient(
  'http://localhost:3002',
  {
    enableAuditLog: true,
  },
  new ConsoleAuditLogger()
);
```

This will show detailed information about requests, retries, and errors.
