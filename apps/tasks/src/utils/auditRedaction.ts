import { logger } from '@bharat-agents/shared';

// =============================================================================
// Sensitive Data Patterns
// =============================================================================

const SENSITIVE_PATTERNS = [
  // OTP patterns
  /otp/i,
  /one.?time.?password/i,
  /verification.?code/i,
  /auth.?code/i,

  // Password patterns
  /password/i,
  /passwd/i,
  /pwd/i,
  /secret/i,
  /private.?key/i,

  // Token patterns
  /token/i,
  /jwt/i,
  /bearer/i,
  /api.?key/i,
  /access.?token/i,
  /refresh.?token/i,
  /session.?token/i,

  // Other sensitive patterns
  /ssn/i,
  /social.?security/i,
  /credit.?card/i,
  /card.?number/i,
  /cvv/i,
  /cvc/i,
  /pin/i,
  /account.?number/i,
  /routing.?number/i,
];

// =============================================================================
// Redaction Functions
// =============================================================================

/**
 * Redact sensitive values from a string
 */
export function redactSensitiveString(value: string): string {
  if (typeof value !== 'string') {
    return value;
  }

  // Check if the string contains any sensitive patterns
  const hasSensitivePattern = SENSITIVE_PATTERNS.some(pattern =>
    pattern.test(value)
  );

  if (hasSensitivePattern) {
    // Redact the entire value if it's sensitive
    return '[REDACTED]';
  }

  return value;
}

/**
 * Redact sensitive values from an object recursively
 */
export function redactSensitiveData(data: unknown): unknown {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === 'string') {
    return redactSensitiveString(data);
  }

  if (typeof data === 'number' || typeof data === 'boolean') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(item => redactSensitiveData(item));
  }

  if (typeof data === 'object') {
    const redacted: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(data)) {
      // Check if the key itself is sensitive
      const isKeySensitive = SENSITIVE_PATTERNS.some(pattern =>
        pattern.test(key)
      );

      if (isKeySensitive) {
        redacted[key] = '[REDACTED]';
        logger.debug({ key }, 'Redacted sensitive key in audit log');
      } else {
        redacted[key] = redactSensitiveData(value);
      }
    }

    return redacted;
  }

  return data;
}

/**
 * Redact sensitive values from audit log entry
 */
export function redactAuditLog(
  auditLog: Record<string, unknown>
): Record<string, unknown> {
  const redacted = { ...auditLog };

  // Redact payload if present
  if (redacted.payload) {
    redacted.payload = redactSensitiveData(redacted.payload);
  }

  // Redact result if present
  if (redacted.result) {
    redacted.result = redactSensitiveData(redacted.result);
  }

  // Redact metadata if present
  if (redacted.metadata) {
    redacted.metadata = redactSensitiveData(redacted.metadata);
  }

  // Redact any other fields that might contain sensitive data
  const fieldsToRedact = ['input', 'output', 'data', 'context', 'options'];

  for (const field of fieldsToRedact) {
    if (redacted[field]) {
      redacted[field] = redactSensitiveData(redacted[field]);
    }
  }

  return redacted;
}

/**
 * Redact sensitive values from multiple audit logs
 */
export function redactAuditLogs(
  auditLogs: Record<string, unknown>[]
): Record<string, unknown>[] {
  return auditLogs.map(log => redactAuditLog(log));
}

/**
 * Check if a value contains sensitive data
 */
export function containsSensitiveData(value: unknown): boolean {
  if (typeof value === 'string') {
    return SENSITIVE_PATTERNS.some(pattern => pattern.test(value));
  }

  if (typeof value === 'object' && value !== null) {
    if (Array.isArray(value)) {
      return value.some(item => containsSensitiveData(item));
    }

    for (const [key, val] of Object.entries(value)) {
      if (
        SENSITIVE_PATTERNS.some(pattern => pattern.test(key)) ||
        containsSensitiveData(val)
      ) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Create a safe version of data for logging
 */
export function createSafeLogData(data: unknown): unknown {
  if (containsSensitiveData(data)) {
    return redactSensitiveData(data);
  }

  return data;
}
