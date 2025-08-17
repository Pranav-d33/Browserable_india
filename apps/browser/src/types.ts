// Browser service types - standalone to avoid shared package dependencies

export type SessionId = string;

export interface BrowserAction {
  id: string;
  type: BrowserActionType;
  url: string;
  selector?: string;
  action?: string;
  data?: Record<string, unknown>;
  screenshot?: boolean;
  createdAt: Date;
  status: BrowserActionStatus;
  result?: BrowserActionResult;
}

export enum BrowserActionType {
  NAVIGATE = 'navigate',
  CLICK = 'click',
  TYPE = 'type',
  SCREENSHOT = 'screenshot',
  EXTRACT = 'extract',
  WAIT = 'wait',
}

export enum BrowserActionStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export interface BrowserActionResult {
  success: boolean;
  data?: unknown;
  error?: string;
  screenshot?: string;
  timestamp: Date;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: Date;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
