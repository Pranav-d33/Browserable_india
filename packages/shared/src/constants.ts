// Application constants

export const APP_NAME = 'Bharat Agents';
export const APP_VERSION = '1.0.0';

// API Constants
export const API_PREFIX = '/api/v1';
export const DEFAULT_PORT = 3000;
export const DEFAULT_HOST = 'localhost';

// Pagination
export const DEFAULT_PAGE_SIZE = 10;
export const MAX_PAGE_SIZE = 100;

// Task Constants
export const TASK_TITLE_MAX_LENGTH = 200;
export const TASK_DESCRIPTION_MAX_LENGTH = 1000;
export const MAX_TAGS_PER_TASK = 10;
export const TAG_MAX_LENGTH = 50;

// Browser Constants
export const DEFAULT_BROWSER_TIMEOUT = 30000; // 30 seconds
export const MAX_SCREENSHOT_SIZE = 10 * 1024 * 1024; // 10MB
export const SUPPORTED_BROWSERS = ['chromium', 'firefox', 'webkit'] as const;

// Validation
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 50;

// Rate Limiting
export const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
export const RATE_LIMIT_MAX_REQUESTS = 100;

// File Upload
export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
export const ALLOWED_FILE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'application/pdf',
  'text/plain',
  'application/json',
];

// Environment
export const NODE_ENV = {
  DEVELOPMENT: 'development',
  PRODUCTION: 'production',
  TEST: 'test',
} as const;

// HTTP Status Codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;
