// Common types used across the application

// JSON-safe value for structured data persisted in DB or sent over the wire
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | { [key: string]: JsonValue }
  | JsonValue[];

// Core identifier types
export type RunId = string;
export type NodeId = string;
export type UserId = string;
export type TaskId = string;
export type BrowserActionId = string;
export type SessionId = string;
export type RequestId = string;

// Role and permission types
export enum Role {
  ADMIN = 'admin',
  USER = 'user',
  VIEWER = 'viewer',
  SYSTEM = 'system',
}

export enum Permission {
  READ = 'read',
  WRITE = 'write',
  DELETE = 'delete',
  EXECUTE = 'execute',
  MANAGE = 'manage',
}

export interface UserPermissions {
  userId: UserId;
  permissions: Permission[];
  resources: string[];
}

// Status types
export enum Status {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  PENDING = 'pending',
  SUSPENDED = 'suspended',
  DELETED = 'deleted',
}

export enum RunStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  TIMEOUT = 'timeout',
}

// Node types for workflow execution
export enum NodeType {
  START = 'start',
  END = 'end',
  TASK = 'task',
  CONDITION = 'condition',
  PARALLEL = 'parallel',
  SEQUENCE = 'sequence',
  API_CALL = 'api_call',
  BROWSER_ACTION = 'browser_action',
  AI_TASK = 'ai_task',
}

export interface Node {
  id: NodeId;
  type: NodeType;
  name: string;
  description?: string;
  config: Record<string, unknown>;
  dependencies: NodeId[];
  timeout?: number;
  retries?: number;
}

export interface Run {
  id: RunId;
  workflowId: string;
  status: RunStatus;
  startedAt: Date;
  completedAt?: Date;
  error?: string;
  result?: unknown;
  metadata: Record<string, unknown>;
  nodes: NodeExecution[];
}

export interface NodeExecution {
  nodeId: NodeId;
  status: RunStatus;
  startedAt: Date;
  completedAt?: Date;
  error?: string;
  result?: unknown;
  attempts: number;
}

// Existing types
export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  createdAt: Date;
  updatedAt: Date;
  dueDate?: Date;
  assignedTo?: string;
  tags?: string[];
}

export enum TaskStatus {
  TODO = 'todo',
  IN_PROGRESS = 'in_progress',
  REVIEW = 'review',
  DONE = 'done',
  CANCELLED = 'cancelled',
}

export enum TaskPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

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

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

export enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
  VIEWER = 'viewer',
}

// Utility types
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

// Environment and configuration types
export interface DatabaseConfig {
  url: string;
  poolSize?: number;
  ssl?: boolean;
}

export interface RedisConfig {
  url: string;
  password?: string;
  db?: number;
}

export interface S3Config {
  endpoint: string;
  accessKey: string;
  secretKey: string;
  bucket: string;
  region?: string;
}

export interface AppConfig {
  nodeEnv: string;
  port: number;
  jwtSecret: string;
  openaiApiKey?: string;
}
