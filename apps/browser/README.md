# Browser Automation API

A Node.js Express API for browser automation using Playwright. This service provides session-based browser management with support for various browser actions like navigation, screenshots, element interaction, and data extraction.

## Features

- **Session Management**: Launch and manage browser sessions with automatic cleanup
- **Browser Actions**: Navigate, click, type, screenshot, extract data, and wait for elements
- **Security**: Helmet, CORS, rate limiting, and input validation with Zod
- **Graceful Shutdown**: Proper cleanup of browser sessions on shutdown
- **Periodic Cleanup**: Automatic cleanup of idle sessions after 30 minutes
- **TypeScript**: Full TypeScript support with type safety

## Environment Variables

The browser service requires minimal environment configuration. Create a `.env` file in the `apps/browser` directory with the following variables:

### Required Variables

- `NODE_ENV`: Environment mode (`development`, `production`, or `test`)
- `PORT`: Server port (default: 3001)
- `HOST`: Server host (default: localhost)

### Optional Variables (with defaults)

- `BROWSER_TIMEOUT`: Browser operation timeout in milliseconds (default: 30000)
- `BROWSER_HEADLESS`: Run browser in headless mode (default: true)
- `BROWSER_VIEWPORT_WIDTH`: Browser viewport width (default: 1280)
- `BROWSER_VIEWPORT_HEIGHT`: Browser viewport height (default: 720)
- `SESSION_TIMEOUT_MINUTES`: Minutes before idle sessions are cleaned up (default: 30)
- `CLEANUP_INTERVAL_MINUTES`: Minutes between cleanup runs (default: 5)

### Example .env file:

```bash
# Service Configuration
NODE_ENV=development
PORT=3001
HOST=localhost

# Browser Configuration (optional)
BROWSER_TIMEOUT=30000
BROWSER_HEADLESS=true
BROWSER_VIEWPORT_WIDTH=1280
BROWSER_VIEWPORT_HEIGHT=720

# Session Management (optional)
SESSION_TIMEOUT_MINUTES=30
CLEANUP_INTERVAL_MINUTES=5
```

## API Endpoints

### Session Management

#### `POST /api/v1/browser/launch`

Launch a new headless browser session.

**Response:**

```json
{
  "success": true,
  "data": {
    "sessionId": "uuid-session-id"
  },
  "message": "Browser session launched successfully",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

#### `DELETE /api/v1/browser/close/:sessionId`

Close a browser session.

**Response:**

```json
{
  "success": true,
  "data": {
    "sessionId": "uuid-session-id"
  },
  "message": "Browser session closed successfully",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

#### `GET /api/v1/browser/sessions`

List all active browser sessions.

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "sessionId": "uuid-session-id",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "lastUsed": "2024-01-01T00:05:00.000Z",
      "isActive": true
    }
  ],
  "message": "Browser sessions retrieved successfully",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Browser Actions

#### `POST /api/v1/browser/actions`

Execute a browser action.

**Request Body:**

```json
{
  "sessionId": "uuid-session-id",
  "type": "navigate|click|type|screenshot|extract|wait",
  "url": "https://example.com",
  "selector": "css-selector", // optional
  "action": "action-name", // optional
  "data": {}, // optional
  "screenshot": false // optional
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "action-uuid",
    "type": "navigate",
    "url": "https://example.com",
    "status": "pending",
    "createdAt": "2024-01-01T00:00:00.000Z"
  },
  "message": "Browser action executed successfully",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

#### `GET /api/v1/browser/actions`

List browser actions with optional filtering.

**Query Parameters:**

- `page` (number): Page number for pagination
- `limit` (number): Number of items per page (1-100)
- `status` (string): Filter by status (pending|running|completed|failed)
- `type` (string): Filter by action type

#### `GET /api/v1/browser/actions/:id`

Get a specific browser action by ID.

### Health Check

#### `GET /health`

Check if the service is healthy.

**Response:**

```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "service": "browser-api"
}
```

## Action Types

### Navigate

Navigate to a URL.

```json
{
  "sessionId": "uuid",
  "type": "navigate",
  "url": "https://example.com"
}
```

### Click

Click an element on the page.

```json
{
  "sessionId": "uuid",
  "type": "click",
  "url": "https://example.com",
  "selector": "button.submit"
}
```

### Type

Type text into an input field.

```json
{
  "sessionId": "uuid",
  "type": "type",
  "url": "https://example.com",
  "selector": "input[name='search']",
  "data": {
    "text": "search term"
  }
}
```

### Screenshot

Take a screenshot of the page.

```json
{
  "sessionId": "uuid",
  "type": "screenshot",
  "url": "https://example.com",
  "screenshot": true
}
```

### Extract

Extract text from an element or page.

```json
{
  "sessionId": "uuid",
  "type": "extract",
  "url": "https://example.com",
  "selector": "h1.title" // optional
}
```

### Wait

Wait for an element to appear or timeout.

```json
{
  "sessionId": "uuid",
  "type": "wait",
  "url": "https://example.com",
  "selector": "div.loaded", // optional
  "data": {
    "timeout": 5000 // optional, in milliseconds
  }
}
```

## Using the Browser Client

The shared package provides a convenient client for interacting with the browser API:

```javascript
import { createBrowserClient } from '@bharat-agents/shared';

const client = createBrowserClient({
  baseUrl: 'http://localhost:3001',
  timeout: 30000,
});

// Launch a session
const { sessionId } = await client.launchSession();

// Navigate to a page
await client.navigate(sessionId, 'https://example.com');

// Take a screenshot
await client.screenshot(sessionId, 'https://example.com');

// Close the session
await client.closeSession(sessionId);
```

## Configuration

### Environment Variables

- `PORT`: Server port (default: 3001)
- `HOST`: Server host (default: localhost)
- `NODE_ENV`: Environment (development|production|test)

### Session Management

- **Session Timeout**: 30 minutes (configurable via `SESSION_TIMEOUT_MINUTES`)
- **Cleanup Interval**: 5 minutes (configurable via `CLEANUP_INTERVAL_MINUTES`)
- **Browser Args**: Optimized for headless operation with security flags

## Development

### Prerequisites

- Node.js 20+
- pnpm

### Installation

```bash
# Install dependencies
pnpm install

# Install Playwright browsers
npx playwright install chromium
```

### Setup Environment

1. Create a `.env` file in the `apps/browser` directory
2. Add the required environment variables (see Environment Variables section above)

### Running the Service

```bash
# Development mode
pnpm dev

# Production mode
pnpm build
pnpm start
```

### Testing

```bash
# Run tests
pnpm test

# Run tests in watch mode
pnpm test:watch
```

## Security Features

- **Helmet**: Security headers
- **CORS**: Cross-origin resource sharing
- **Rate Limiting**: 50 requests per 15 minutes per IP
- **Input Validation**: Zod schema validation
- **Request Size Limits**: 50MB for screenshots

## Architecture

- **Express.js**: Web framework
- **Playwright**: Browser automation
- **TypeScript**: Type safety
- **In-Memory Storage**: Session and action storage (for Phase 0)
- **Graceful Shutdown**: Proper cleanup on process termination

## Future Enhancements

- Database persistence for sessions and actions
- Redis for session storage
- WebSocket support for real-time updates
- Docker containerization
- Kubernetes deployment
- Metrics and monitoring
- Authentication and authorization
