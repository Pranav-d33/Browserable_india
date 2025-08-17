import { logger } from '@bharat-agents/shared';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface AuditEvent {
  runId: string;
  nodeId?: string;
  userId?: string;
  action: string;
  payload?: any;
  result?: any;
  status: 'OK' | 'ERR';
  durationMs: number;
}

// Maximum size for JSONB fields to prevent database issues
const MAX_JSONB_SIZE = 1000000; // 1MB

// Patterns to redact sensitive information (case insensitive)
const SECRET_PATTERNS = [
  /(otp|password|secret|token)["\s]*:["\s]*["'][^"']*["']/gi,
  /(api_key|access_key|private_key)["\s]*:["\s]*["'][^"']*["']/gi,
  /(auth_token|bearer_token|jwt_token)["\s]*:["\s]*["'][^"']*["']/gi,
  /(client_secret|app_secret|user_secret)["\s]*:["\s]*["'][^"']*["']/gi,
];

/**
 * Redacts sensitive information from JSON data
 */
function redactSecrets(data: any): any {
  if (typeof data === 'string') {
    let redacted = data;
    SECRET_PATTERNS.forEach(pattern => {
      redacted = redacted.replace(pattern, (match) => {
        const parts = match.split(':');
        if (parts.length >= 2) {
          return `${parts[0]}: "[REDACTED]"`;
        }
        return match;
      });
    });
    return redacted;
  }
  
  if (typeof data === 'object' && data !== null) {
    if (Array.isArray(data)) {
      return data.map(item => redactSecrets(item));
    }
    
    const redacted: any = {};
    for (const [key, value] of Object.entries(data)) {
      // Redact common secret keys (case insensitive)
      const lowerKey = key.toLowerCase();
      if (lowerKey.includes('otp') || 
          lowerKey.includes('password') || 
          lowerKey.includes('secret') || 
          lowerKey.includes('token') ||
          lowerKey.includes('key') && (lowerKey.includes('api') || lowerKey.includes('access') || lowerKey.includes('private'))) {
        redacted[key] = '[REDACTED]';
      } else {
        redacted[key] = redactSecrets(value);
      }
    }
    return redacted;
  }
  
  return data;
}

/**
 * Truncates data if it exceeds the maximum JSONB size
 */
function truncateIfNeeded(data: any): any {
  const jsonString = JSON.stringify(data);
  if (jsonString.length <= MAX_JSONB_SIZE) {
    return data;
  }
  
  // Try to truncate while preserving structure
  if (typeof data === 'object' && data !== null) {
    if (Array.isArray(data)) {
      // For arrays, keep first few items and indicate truncation
      const truncated = data.slice(0, 10);
      return {
        ...truncated,
        _truncated: true,
        _originalLength: data.length,
        _message: `Array truncated from ${data.length} items to ${truncated.length} items`
      };
    } else {
      // For objects, try to keep essential fields and truncate large ones
      const truncated: any = {};
      for (const [key, value] of Object.entries(data)) {
        const valueString = JSON.stringify(value);
        if (valueString.length > MAX_JSONB_SIZE / 10) { // If any single field is too large
          truncated[key] = {
            _truncated: true,
            _originalSize: valueString.length,
            _message: `Field '${key}' was too large and has been truncated`
          };
        } else {
          truncated[key] = value;
        }
      }
      return truncated;
    }
  }
  
  // For strings or other types, truncate directly
  return {
    _truncated: true,
    _originalSize: jsonString.length,
    _message: 'Data was too large and has been truncated',
    _preview: jsonString.substring(0, 1000) + '...'
  };
}

/**
 * Records an audit event in the database
 */
export async function record(event: AuditEvent): Promise<void> {
  try {
    const startTime = Date.now();
    
    // Process payload and result
    const processedPayload = event.payload ? truncateIfNeeded(redactSecrets(event.payload)) : null;
    const processedResult = event.result ? truncateIfNeeded(redactSecrets(event.result)) : null;
    
    // Create audit log entry
    await prisma.auditLog.create({
      data: {
        runId: event.runId,
        nodeId: event.nodeId,
        userId: event.userId,
        action: event.action,
        status: event.status,
        durationMs: event.durationMs,
        payload: processedPayload,
        result: processedResult,
      },
    });
    
    const processingTime = Date.now() - startTime;
    logger.debug(
      {
        runId: event.runId,
        action: event.action,
        status: event.status,
        processingTime,
        payloadSize: event.payload ? JSON.stringify(event.payload).length : 0,
        resultSize: event.result ? JSON.stringify(event.result).length : 0,
      },
      'Audit event recorded successfully'
    );
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        runId: event.runId,
        action: event.action,
      },
      'Failed to record audit event'
    );
    
    // Don't throw the error to avoid breaking the main flow
    // The audit failure shouldn't cause the main operation to fail
  }
}

/**
 * Retrieves audit logs for a specific run with cursor-based pagination
 */
export async function getAuditLogs(
  runId: string,
  cursor?: string,
  limit: number = 50
): Promise<{
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
}> {
  try {
    const where = { runId };
    const take = Math.min(limit, 100); // Cap at 100 items per request
    
    const logs = await prisma.auditLog.findMany({
      where,
      take: take + 1, // Take one extra to determine if there are more
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        runId: true,
        nodeId: true,
        userId: true,
        action: true,
        status: true,
        durationMs: true,
        payload: true,
        result: true,
        createdAt: true,
      },
    });
    
    const hasMore = logs.length > take;
    const actualLogs = hasMore ? logs.slice(0, take) : logs;
    const nextCursor = hasMore ? actualLogs[actualLogs.length - 1].id : undefined;
    
    return {
      logs: actualLogs,
      nextCursor,
      hasMore,
    };
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        runId,
        cursor,
        limit,
      },
      'Failed to retrieve audit logs'
    );
    throw error;
  }
}

/**
 * Gets audit statistics for a run
 */
export async function getAuditStats(runId: string): Promise<{
  totalEvents: number;
  successCount: number;
  errorCount: number;
  averageDuration: number;
  actions: Array<{ action: string; count: number }>;
}> {
  try {
    const [totalEvents, successCount, errorCount, avgDuration, actionStats] = await Promise.all([
      prisma.auditLog.count({ where: { runId } }),
      prisma.auditLog.count({ where: { runId, status: 'OK' } }),
      prisma.auditLog.count({ where: { runId, status: 'ERR' } }),
      prisma.auditLog.aggregate({
        where: { runId },
        _avg: { durationMs: true },
      }),
      prisma.auditLog.groupBy({
        by: ['action'],
        where: { runId },
        _count: { action: true },
        orderBy: { _count: { action: 'desc' } },
      }),
    ]);
    
    return {
      totalEvents,
      successCount,
      errorCount,
      averageDuration: avgDuration._avg.durationMs || 0,
      actions: actionStats.map(stat => ({
        action: stat.action,
        count: stat._count.action,
      })),
    };
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        runId,
      },
      'Failed to retrieve audit statistics'
    );
    throw error;
  }
}
