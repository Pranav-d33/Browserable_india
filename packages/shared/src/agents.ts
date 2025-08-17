// Agent types and utilities for Bharat Agents system

// =============================================================================
// ENUMS
// =============================================================================

export enum AgentKind {
  ECHO = 'ECHO',
  BROWSER = 'BROWSER',
  GEN = 'GEN',
  RESEARCH = 'RESEARCH',
}

export enum AgentRunStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  TIMEOUT = 'timeout',
  PAUSED = 'paused',
}

export enum AgentNodeStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  SKIPPED = 'skipped',
  WAITING = 'waiting',
}

export enum AgentCapability {
  TEXT_GENERATION = 'text_generation',
  BROWSER_AUTOMATION = 'browser_automation',
  WEB_RESEARCH = 'web_search',
  FILE_OPERATIONS = 'file_operations',
  API_CALLS = 'api_calls',
  DATA_PROCESSING = 'data_processing',
  IMAGE_GENERATION = 'image_generation',
  CODE_EXECUTION = 'code_execution',
}

// =============================================================================
// CORE TYPES
// =============================================================================

export type AgentId = string;
export type AgentRunId = string;
export type AgentNodeId = string;
export type AgentSessionId = string;
export type AgentRequestId = string;

export interface Agent {
  id: AgentId;
  kind: AgentKind;
  name: string;
  description?: string;
  version: string;
  capabilities: AgentCapability[];
  config: AgentConfig;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

export interface AgentConfig {
  timeout?: number;
  maxRetries?: number;
  rateLimit?: {
    requests: number;
    windowMs: number;
  };
  memory?: {
    maxSize: number;
    ttl: number;
  };
  security?: {
    allowedDomains?: string[];
    blockedDomains?: string[];
    maxRequestSize?: number;
  };
  [key: string]: unknown;
}

export interface AgentRun {
  id: AgentRunId;
  agentId: AgentId;
  status: AgentRunStatus;
  input: AgentRunInput;
  output?: AgentRunOutput;
  error?: AgentRunError;
  metadata: Record<string, unknown>;
  startedAt: Date;
  completedAt?: Date;
  duration?: number;
  nodes: AgentNodeExecution[];
}

export interface AgentRunInput {
  prompt?: string;
  data?: Record<string, unknown>;
  context?: Record<string, unknown>;
  options?: Record<string, unknown>;
}

export interface AgentRunOutput {
  result: unknown;
  metadata?: Record<string, unknown>;
  usage?: {
    tokens?: number;
    cost?: number;
    duration?: number;
  };
}

export interface AgentRunError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  stack?: string;
}

export interface AgentNodeExecution {
  id: AgentNodeId;
  name: string;
  type: string;
  status: AgentNodeStatus;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  startedAt: Date;
  completedAt?: Date;
  duration?: number;
  attempts: number;
  maxAttempts: number;
  retryDelay?: number;
}

// =============================================================================
// PAYLOAD INTERFACES
// =============================================================================

export interface EchoAgentPayload {
  message: string;
  echoCount?: number;
  delay?: number;
  format?: 'text' | 'json' | 'xml';
}

export interface BrowserAgentPayload {
  sessionId: AgentSessionId;
  actions: AgentBrowserAction[];
  options?: {
    headless?: boolean;
    timeout?: number;
    viewport?: {
      width: number;
      height: number;
    };
    userAgent?: string;
  };
}

export interface AgentBrowserAction {
  type:
    | 'navigate'
    | 'click'
    | 'type'
    | 'screenshot'
    | 'extract'
    | 'wait'
    | 'scroll';
  url?: string;
  selector?: string;
  text?: string;
  data?: Record<string, unknown>;
  options?: Record<string, unknown>;
}

export interface GenAgentPayload {
  prompt: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stop?: string[];
  systemPrompt?: string;
  context?: Record<string, unknown>;
  options?: {
    stream?: boolean;
    format?: 'text' | 'json' | 'markdown';
    includeMetadata?: boolean;
  };
}

export interface ResearchAgentPayload {
  query: string;
  sources?: string[];
  depth?: 'shallow' | 'medium' | 'deep';
  maxResults?: number;
  includeImages?: boolean;
  includeLinks?: boolean;
  options?: {
    searchEngine?: 'google' | 'bing' | 'duckduckgo';
    language?: string;
    region?: string;
    timeRange?: string;
  };
}

export interface AgentRequest {
  agentId: AgentId;
  payload:
    | EchoAgentPayload
    | BrowserAgentPayload
    | GenAgentPayload
    | ResearchAgentPayload;
  options?: {
    timeout?: number;
    priority?: 'low' | 'normal' | 'high';
    tags?: string[];
    metadata?: Record<string, unknown>;
  };
}

export interface AgentResponse {
  runId: AgentRunId;
  status: AgentRunStatus;
  result?: unknown;
  error?: AgentRunError;
  metadata?: Record<string, unknown>;
  usage?: {
    tokens?: number;
    cost?: number;
    duration?: number;
  };
}

// =============================================================================
// TYPE GUARDS
// =============================================================================

export function isAgentKind(value: unknown): value is AgentKind {
  return (
    typeof value === 'string' &&
    Object.values(AgentKind).includes(value as AgentKind)
  );
}

export function isAgentRunStatus(value: unknown): value is AgentRunStatus {
  return (
    typeof value === 'string' &&
    Object.values(AgentRunStatus).includes(value as AgentRunStatus)
  );
}

export function isAgentNodeStatus(value: unknown): value is AgentNodeStatus {
  return (
    typeof value === 'string' &&
    Object.values(AgentNodeStatus).includes(value as AgentNodeStatus)
  );
}

export function isAgentCapability(value: unknown): value is AgentCapability {
  return (
    typeof value === 'string' &&
    Object.values(AgentCapability).includes(value as AgentCapability)
  );
}

export function isAgent(value: unknown): value is Agent {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'kind' in value &&
    'name' in value &&
    'version' in value &&
    'capabilities' in value &&
    'config' in value &&
    'metadata' in value &&
    'createdAt' in value &&
    'updatedAt' in value &&
    'isActive' in value
  );
}

export function isAgentRun(value: unknown): value is AgentRun {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'agentId' in value &&
    'status' in value &&
    'input' in value &&
    'metadata' in value &&
    'startedAt' in value &&
    'nodes' in value
  );
}

export function isAgentNodeExecution(
  value: unknown
): value is AgentNodeExecution {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'name' in value &&
    'type' in value &&
    'status' in value &&
    'input' in value &&
    'startedAt' in value &&
    'attempts' in value &&
    'maxAttempts' in value
  );
}

export function isEchoAgentPayload(value: unknown): value is EchoAgentPayload {
  return (
    typeof value === 'object' &&
    value !== null &&
    'message' in value &&
    typeof (value as EchoAgentPayload).message === 'string'
  );
}

export function isBrowserAgentPayload(
  value: unknown
): value is BrowserAgentPayload {
  return (
    typeof value === 'object' &&
    value !== null &&
    'sessionId' in value &&
    'actions' in value &&
    Array.isArray((value as BrowserAgentPayload).actions)
  );
}

export function isGenAgentPayload(value: unknown): value is GenAgentPayload {
  return (
    typeof value === 'object' &&
    value !== null &&
    'prompt' in value &&
    typeof (value as GenAgentPayload).prompt === 'string'
  );
}

export function isResearchAgentPayload(
  value: unknown
): value is ResearchAgentPayload {
  return (
    typeof value === 'object' &&
    value !== null &&
    'query' in value &&
    typeof (value as ResearchAgentPayload).query === 'string'
  );
}

// =============================================================================
// SERIALIZERS & UTILITIES
// =============================================================================

/**
 * Safe JSON stringify with BigInt handling
 */
export function safeStringify(value: unknown, space?: number): string {
  return JSON.stringify(
    value,
    (key, val) => {
      if (typeof val === 'bigint') {
        return val.toString() + 'n';
      }
      if (val instanceof Date) {
        return val.toISOString();
      }
      if (val instanceof Error) {
        return {
          name: val.name,
          message: val.message,
          stack: val.stack,
        };
      }
      if (val instanceof Map) {
        return Object.fromEntries(val);
      }
      if (val instanceof Set) {
        return Array.from(val);
      }
      return val;
    },
    space
  );
}

/**
 * Safe JSON parse with BigInt handling
 */
export function safeParse(json: string): unknown {
  return JSON.parse(json, (key, val) => {
    if (typeof val === 'string' && val.endsWith('n')) {
      return BigInt(val.slice(0, -1));
    }
    return val;
  });
}

/**
 * Deep clone an object with proper handling of special types
 */
export function deepCloneAgent<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (obj instanceof Date) {
    return new Date(obj.getTime()) as T;
  }

  if (obj instanceof Array) {
    return obj.map(item => deepCloneAgent(item)) as T;
  }

  if (obj instanceof Map) {
    return new Map(
      Array.from(obj.entries()).map(([key, value]) => [
        key,
        deepCloneAgent(value),
      ])
    ) as T;
  }

  if (obj instanceof Set) {
    return new Set(Array.from(obj).map(item => deepCloneAgent(item))) as T;
  }

  if (typeof obj === 'object') {
    const cloned = {} as T;
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        cloned[key] = deepCloneAgent(obj[key]);
      }
    }
    return cloned;
  }

  return obj;
}

/**
 * Validate agent configuration
 */
export function validateAgentConfig(config: unknown): config is AgentConfig {
  if (typeof config !== 'object' || config === null) {
    return false;
  }

  const cfg = config as AgentConfig;

  if (
    cfg.timeout !== undefined &&
    (typeof cfg.timeout !== 'number' || cfg.timeout <= 0)
  ) {
    return false;
  }

  if (
    cfg.maxRetries !== undefined &&
    (typeof cfg.maxRetries !== 'number' || cfg.maxRetries < 0)
  ) {
    return false;
  }

  if (cfg.rateLimit !== undefined) {
    if (typeof cfg.rateLimit !== 'object' || cfg.rateLimit === null) {
      return false;
    }
    if (
      typeof cfg.rateLimit.requests !== 'number' ||
      cfg.rateLimit.requests <= 0
    ) {
      return false;
    }
    if (
      typeof cfg.rateLimit.windowMs !== 'number' ||
      cfg.rateLimit.windowMs <= 0
    ) {
      return false;
    }
  }

  return true;
}

/**
 * Create a default agent configuration
 */
export function createDefaultAgentConfig(kind: AgentKind): AgentConfig {
  const baseConfig: AgentConfig = {
    timeout: 30000,
    maxRetries: 3,
    metadata: {},
  };

  switch (kind) {
    case AgentKind.ECHO:
      return {
        ...baseConfig,
        timeout: 5000,
      };

    case AgentKind.BROWSER:
      return {
        ...baseConfig,
        timeout: 60000,
        maxRetries: 1,
        security: {
          maxRequestSize: 50 * 1024 * 1024, // 50MB
        },
      };

    case AgentKind.GEN:
      return {
        ...baseConfig,
        timeout: 120000,
        maxRetries: 2,
        rateLimit: {
          requests: 10,
          windowMs: 60000, // 1 minute
        },
      };

    case AgentKind.RESEARCH:
      return {
        ...baseConfig,
        timeout: 90000,
        maxRetries: 2,
        rateLimit: {
          requests: 5,
          windowMs: 60000, // 1 minute
        },
      };

    default:
      return baseConfig;
  }
}

/**
 * Calculate run duration in milliseconds
 */
export function calculateAgentRunDuration(run: AgentRun): number | undefined {
  if (!run.completedAt) {
    return undefined;
  }
  return run.completedAt.getTime() - run.startedAt.getTime();
}

/**
 * Check if a run is in a terminal state
 */
export function isAgentRunTerminal(status: AgentRunStatus): boolean {
  return [
    AgentRunStatus.COMPLETED,
    AgentRunStatus.FAILED,
    AgentRunStatus.CANCELLED,
    AgentRunStatus.TIMEOUT,
  ].includes(status);
}

/**
 * Check if a node is in a terminal state
 */
export function isAgentNodeTerminal(status: AgentNodeStatus): boolean {
  return [
    AgentNodeStatus.COMPLETED,
    AgentNodeStatus.FAILED,
    AgentNodeStatus.CANCELLED,
    AgentNodeStatus.SKIPPED,
  ].includes(status);
}

/**
 * Get agent capabilities for a specific agent kind
 */
export function getAgentCapabilities(kind: AgentKind): AgentCapability[] {
  switch (kind) {
    case AgentKind.ECHO:
      return [AgentCapability.TEXT_GENERATION];

    case AgentKind.BROWSER:
      return [
        AgentCapability.BROWSER_AUTOMATION,
        AgentCapability.FILE_OPERATIONS,
        AgentCapability.API_CALLS,
      ];

    case AgentKind.GEN:
      return [
        AgentCapability.TEXT_GENERATION,
        AgentCapability.IMAGE_GENERATION,
        AgentCapability.CODE_EXECUTION,
        AgentCapability.DATA_PROCESSING,
      ];

    case AgentKind.RESEARCH:
      return [
        AgentCapability.WEB_RESEARCH,
        AgentCapability.TEXT_GENERATION,
        AgentCapability.DATA_PROCESSING,
      ];

    default:
      return [];
  }
}

/**
 * Generate a unique run ID
 */
export function generateAgentRunId(): AgentRunId {
  return `agent_run_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate a unique node ID
 */
export function generateAgentNodeId(): AgentNodeId {
  return `agent_node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a new run instance
 */
export function createAgentRun(
  agentId: AgentId,
  input: AgentRunInput,
  metadata: Record<string, unknown> = {}
): AgentRun {
  return {
    id: generateAgentRunId(),
    agentId,
    status: AgentRunStatus.PENDING,
    input,
    metadata,
    startedAt: new Date(),
    nodes: [],
  };
}

/**
 * Create a new node execution instance
 */
export function createAgentNodeExecution(
  name: string,
  type: string,
  input: Record<string, unknown>,
  maxAttempts: number = 1
): AgentNodeExecution {
  return {
    id: generateAgentNodeId(),
    name,
    type,
    status: AgentNodeStatus.PENDING,
    input,
    startedAt: new Date(),
    attempts: 0,
    maxAttempts,
  };
}
