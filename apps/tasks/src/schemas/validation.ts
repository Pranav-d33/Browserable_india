import { z } from 'zod';

// =============================================================================
// Base Schemas
// =============================================================================

// Agent name validation - support BROWSER and GEN agents
export const agentSchema = z.enum(['BROWSER', 'GEN']).optional();

// Input validation - prevent XSS and limit size
export const inputSchema = z
  .string()
  .min(1, 'Input is required')
  .max(10000, 'Input too long (max 10KB)')
  .refine(
    (input) => {
      // Basic XSS prevention - reject potentially dangerous content
      const dangerousPatterns = [
        /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
        /javascript:/gi,
        /on\w+\s*=/gi,
        /<iframe\b/gi,
        /<object\b/gi,
        /<embed\b/gi,
        /<form\b/gi,
        /<input\b/gi,
        /<textarea\b/gi,
        /<select\b/gi,
        /<button\b/gi,
        /<link\b/gi,
        /<meta\b/gi,
        /<style\b/gi,
        /<base\b/gi,
        /<title\b/gi,
        /<head\b/gi,
        /<body\b/gi,
        /<html\b/gi,
        /<xml\b/gi,
        /<svg\b/gi,
        /<math\b/gi,
        /<applet\b/gi,
        /<bgsound\b/gi,
        /<link\b/gi,
        /<meta\b/gi,
        /<title\b/gi,
        /<xmp\b/gi,
        /<plaintext\b/gi,
        /<listing\b/gi,
        /<marquee\b/gi,
        /<nobr\b/gi,
        /<noembed\b/gi,
        /<noframes\b/gi,
        /<noscript\b/gi,
        /<wbr\b/gi,
        /<xmp\b/gi,
        /<plaintext\b/gi,
        /<listing\b/gi,
        /<marquee\b/gi,
        /<nobr\b/gi,
        /<noembed\b/gi,
        /<noframes\b/gi,
        /<noscript\b/gi,
        /<wbr\b/gi,
      ];
      
      return !dangerousPatterns.some(pattern => pattern.test(input));
    },
    {
      message: 'Input contains potentially dangerous content',
    }
  );

// Options validation for task creation
export const taskOptionsSchema = z
  .object({
    timeout: z.number().min(1000).max(300000).optional(), // 1s to 5m
    priority: z.enum(['low', 'normal', 'high']).optional(),
    tags: z.array(z.string().max(50)).optional(),
    metadata: z.record(z.unknown()).optional(),
  })
  .strict()
  .optional();

// Artifact validation
export const artifactSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  url: z.string().url().optional(),
  size: z.number().optional(),
  createdAt: z.string().datetime(),
});

// =============================================================================
// Request Schemas
// =============================================================================

// Enhanced task creation request schema
export const createTaskSchema = z
  .object({
    agent: agentSchema,
    input: inputSchema,
    options: taskOptionsSchema,
  })
  .strict(); // Reject any unknown fields

// Legacy task creation request schema (for backward compatibility)
export const createTaskLegacySchema = z
  .object({
    agent: z.enum(['echo', 'browser', 'llm']).optional().default('echo'),
    input: inputSchema,
    meta: z
      .object({
        source: z.string().optional(),
        priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
        tags: z.array(z.string()).optional(),
        userId: z.string().optional(),
        sessionId: z.string().optional(),
        requestId: z.string().optional(),
        timestamp: z.string().datetime().optional(),
      })
      .strict()
      .optional()
      .default({}),
  })
  .strict();

// List runs request schema
export const listRunsSchema = z
  .object({
    limit: z
      .string()
      .regex(/^\d+$/, 'Limit must be a number')
      .transform((val) => parseInt(val, 10))
      .refine((val) => val > 0 && val <= 100, 'Limit must be between 1 and 100')
      .optional()
      .default('20'),
    cursor: z
      .string()
      .optional(),
    status: z
      .enum(['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED'])
      .optional(),
    agent: z
      .string()
      .optional(),
  })
  .strict();

// =============================================================================
// Response Schemas
// =============================================================================

// Enhanced task response schema with artifacts
export const taskResponseSchema = z.object({
  runId: z.string(),
  status: z.enum(['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED']),
  agent: z.string(),
  input: z.string(),
  output: z.string().optional(),
  artifacts: z.array(artifactSchema).optional(),
  createdAt: z.string().datetime(),
});

// Run details response schema (for GET /v1/runs/:id)
export const runDetailsResponseSchema = z.object({
  run: z.object({
    id: z.string(),
    agentId: z.string(),
    status: z.enum(['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED']),
    input: z.object({
      prompt: z.string().optional(),
      data: z.record(z.unknown()).optional(),
      context: z.record(z.unknown()).optional(),
    }),
    output: z.object({
      result: z.unknown(),
      metadata: z.record(z.unknown()).optional(),
      usage: z.object({
        tokens: z.number().optional(),
        cost: z.number().optional(),
        duration: z.number().optional(),
      }).optional(),
    }).optional(),
    error: z.object({
      code: z.string(),
      message: z.string(),
      details: z.record(z.unknown()).optional(),
    }).optional(),
    metadata: z.record(z.unknown()),
    startedAt: z.string().datetime(),
    completedAt: z.string().datetime().optional(),
    duration: z.number().optional(),
  }),
  nodes: z.array(z.object({
    id: z.string(),
    name: z.string(),
    type: z.string(),
    status: z.enum(['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED', 'SKIPPED', 'WAITING']),
    input: z.record(z.unknown()),
    output: z.record(z.unknown()).optional(),
    error: z.object({
      code: z.string(),
      message: z.string(),
      details: z.record(z.unknown()).optional(),
    }).optional(),
    startedAt: z.string().datetime(),
    completedAt: z.string().datetime().optional(),
    duration: z.number().optional(),
    attempts: z.number(),
    maxAttempts: z.number(),
  })),
  artifacts: z.array(artifactSchema).optional(),
});

// Audit logs response schema
export const auditLogsResponseSchema = z.object({
  logs: z.array(z.object({
    id: z.string(),
    runId: z.string(),
    nodeId: z.string().optional(),
    userId: z.string().optional(),
    action: z.string(),
    status: z.string(),
    durationMs: z.number(),
    payload: z.unknown().optional(),
    result: z.unknown().optional(),
    createdAt: z.string().datetime(),
  })),
  stats: z.object({
    totalEvents: z.number(),
    successCount: z.number(),
    errorCount: z.number(),
    averageDuration: z.number(),
    actions: z.array(z.object({
      action: z.string(),
      count: z.number(),
    })),
  }),
  pagination: z.object({
    nextCursor: z.string().optional(),
    hasMore: z.boolean(),
  }),
});

// List runs response schema
export const listRunsResponseSchema = z.object({
  runs: z.array(taskResponseSchema),
  pagination: z.object({
    nextCursor: z.string().optional(),
    hasMore: z.boolean(),
    total: z.number().optional(),
  }),
});

// Health response schema
export const healthResponseSchema = z.object({
  status: z.enum(['ok', 'error']),
  timestamp: z.string().datetime(),
  uptime: z.number(),
  environment: z.string(),
});

// Readiness response schema
export const readinessResponseSchema = z.object({
  status: z.enum(['ready', 'not ready']),
  timestamp: z.string().datetime(),
  database: z.enum(['connected', 'disconnected']),
  redis: z.enum(['connected', 'disconnected']),
});

// =============================================================================
// Error Response Schemas
// =============================================================================

// Validation error schema
export const validationErrorSchema = z.object({
  error: z.string(),
  message: z.string(),
  traceId: z.string(),
  requestId: z.string(),
  timestamp: z.string().datetime(),
  path: z.string(),
  method: z.string(),
  statusCode: z.number(),
  details: z.object({
    field: z.string().optional(),
    message: z.string().optional(),
    value: z.unknown().optional(),
  }).optional(),
});

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Sanitize output to prevent XSS and information disclosure
 */
export const sanitizeOutput = (data: unknown): unknown => {
  if (typeof data === 'string') {
    // Basic HTML entity encoding for output
    return data
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }
  
  if (Array.isArray(data)) {
    return data.map(sanitizeOutput);
  }
  
  if (data && typeof data === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      // Skip sensitive fields
      if (['password', 'token', 'secret', 'key', 'authorization'].some(sensitive => 
        key.toLowerCase().includes(sensitive)
      )) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = sanitizeOutput(value);
      }
    }
    return sanitized;
  }
  
  return data;
};

/**
 * Validate and sanitize request body
 */
export const validateAndSanitizeRequest = <T extends z.ZodType>(
  schema: T,
  data: unknown
): z.infer<T> => {
  // Validate with strict schema
  const validated = schema.parse(data);
  
  // Additional sanitization for validated data
  return sanitizeOutput(validated) as z.infer<T>;
};

/**
 * Create sanitized response
 */
export const createSanitizedResponse = <T extends z.ZodType>(
  schema: T,
  data: unknown
): z.infer<T> => {
  // Validate response data
  const validated = schema.parse(data);
  
  // Sanitize for output
  return sanitizeOutput(validated) as z.infer<T>;
};

// =============================================================================
// Type Exports
// =============================================================================

export type CreateTaskRequest = z.infer<typeof createTaskSchema>;
export type CreateTaskLegacyRequest = z.infer<typeof createTaskLegacySchema>;
export type TaskResponse = z.infer<typeof taskResponseSchema>;
export type RunDetailsResponse = z.infer<typeof runDetailsResponseSchema>;
export type AuditLogsResponse = z.infer<typeof auditLogsResponseSchema>;
export type HealthResponse = z.infer<typeof healthResponseSchema>;
export type ReadinessResponse = z.infer<typeof readinessResponseSchema>;
export type ValidationError = z.infer<typeof validationErrorSchema>;
