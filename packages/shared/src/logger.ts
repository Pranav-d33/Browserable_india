import pino from 'pino';

// Get NODE_ENV safely for logger configuration
const getNodeEnv = () => {
  return process.env.NODE_ENV || 'development';
};

// Redaction patterns for sensitive data
const redactPatterns = [
  'authorization',
  'cookie',
  'password',
  'secret',
  'token',
  'key',
  'credential',
  'api_key',
  'access_token',
  'refresh_token',
  'private_key',
  'public_key',
  'session_id',
  'auth_token',
  'bearer',
  'basic',
];

// Create redaction regex pattern
const redactRegex = new RegExp(`(${redactPatterns.join('|')})`, 'i');

// Base logger configuration
const baseConfig = {
  level: getNodeEnv() === 'production' ? 'info' : 'debug',
  redact: {
    paths: redactPatterns,
    remove: true,
  },
  serializers: {
    req: (req: any) => {
      const serialized = pino.stdSerializers.req(req);
      // Additional redaction for request headers
      if (serialized.headers) {
        Object.keys(serialized.headers).forEach(key => {
          if (redactRegex.test(key)) {
            serialized.headers[key] = '[REDACTED]';
          }
        });
      }
      return serialized;
    },
    res: pino.stdSerializers.res,
    err: pino.stdSerializers.err,
  },
  formatters: {
    level: (label: string) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
};

// Development configuration with pretty printing
const devConfig = {
  ...baseConfig,
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
      messageFormat: '{msg} {req.method} {req.url} {res.statusCode}',
    },
  },
};

// Production configuration
const prodConfig = {
  ...baseConfig,
  // In production, we want structured JSON logs
  messageKey: 'message',
  errorKey: 'error',
};

// Create logger instance
export const logger = pino(
  getNodeEnv() === 'development' ? devConfig : prodConfig
);

// Export logger types
export type Logger = typeof logger;

// Create child logger with context
export const createLogger = (context: string) => logger.child({ context });

// Export pino for advanced usage
export { pino };
