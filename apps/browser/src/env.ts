import { z } from 'zod';

// Environment schema validation
const envSchema = z.object({
  // Server configuration
  PORT: z
    .string()
    .refine(val => {
      const num = parseInt(val, 10);
      return !isNaN(num) && num > 0 && num.toString() === val;
    }, 'PORT must be a valid positive integer')
    .transform(val => parseInt(val, 10))
    .default('3001'),

  NODE_ENV: z
    .enum(['development', 'production', 'test'], {
      errorMap: () => ({
        message: 'NODE_ENV must be development, production, or test',
      }),
    })
    .default('development'),

  // CORS configuration
  CORS_ORIGIN: z
    .string()
    .url('CORS_ORIGIN must be a valid URL')
    .default('http://localhost:3000'),

  // Browser configuration
  BROWSER_MAX_CONCURRENT: z
    .string()
    .refine(val => {
      const num = parseInt(val, 10);
      return !isNaN(num) && num > 0 && num <= 10;
    }, 'BROWSER_MAX_CONCURRENT must be between 1 and 10')
    .transform(val => parseInt(val, 10))
    .default('4'),

  SESSION_IDLE_MS: z
    .string()
    .refine(val => {
      const num = parseInt(val, 10);
      return !isNaN(num) && num > 0;
    }, 'SESSION_IDLE_MS must be a positive integer')
    .transform(val => parseInt(val, 10))
    .default('300000'), // 5 minutes

  MAX_NAVIGATION_TIMEOUT_MS: z
    .string()
    .refine(val => {
      const num = parseInt(val, 10);
      return !isNaN(num) && num > 0;
    }, 'MAX_NAVIGATION_TIMEOUT_MS must be a positive integer')
    .transform(val => parseInt(val, 10))
    .default('30000'), // 30 seconds

  // Security configuration
  ALLOW_EVALUATE: z
    .string()
    .refine(
      val => val === 'true' || val === 'false',
      'ALLOW_EVALUATE must be true or false'
    )
    .transform(val => val === 'true')
    .default('false'),

  BLOCK_PRIVATE_ADDR: z
    .string()
    .refine(
      val => val === 'true' || val === 'false',
      'BLOCK_PRIVATE_ADDR must be true or false'
    )
    .transform(val => val === 'true')
    .default('true'),

  ALLOW_LOCALHOST: z
    .string()
    .refine(
      val => val === 'true' || val === 'false',
      'ALLOW_LOCALHOST must be true or false'
    )
    .transform(val => val === 'true')
    .default('false'),

  ALLOW_DOWNLOADS: z
    .string()
    .refine(
      val => val === 'true' || val === 'false',
      'ALLOW_DOWNLOADS must be true or false'
    )
    .transform(val => val === 'true')
    .default('false'),

  // Rate limiting
  RATE_LIMIT_WINDOW_MS: z
    .string()
    .refine(val => {
      const num = parseInt(val, 10);
      return !isNaN(num) && num > 0;
    }, 'RATE_LIMIT_WINDOW_MS must be a positive integer')
    .transform(val => parseInt(val, 10))
    .default('900000'), // 15 minutes

  RATE_LIMIT_MAX_REQUESTS: z
    .string()
    .refine(val => {
      const num = parseInt(val, 10);
      return !isNaN(num) && num > 0;
    }, 'RATE_LIMIT_MAX_REQUESTS must be a positive integer')
    .transform(val => parseInt(val, 10))
    .default('100'),

  // Service information
  SERVICE_NAME: z.string().default('bharat-agents-browser'),
  SERVICE_VERSION: z.string().default('1.0.0'),

  // OpenTelemetry configuration
  OTEL_EXPORTER_OTLP_ENDPOINT: z
    .string()
    .url('Invalid OTLP endpoint')
    .optional(),
  OTEL_EXPORTER_OTLP_HEADERS: z.string().optional(),

  // Session store configuration (for future external session store)
  SESSION_STORE_TYPE: z.enum(['memory', 'redis']).default('memory'),
  SESSION_STORE_REDIS_URL: z.string().url('Invalid Redis URL').optional(),
});

// Parse and validate environment variables
const parseEnv = (): z.infer<typeof envSchema> => {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors.map(
        err => `${err.path.join('.')}: ${err.message}`
      );
      throw new Error(
        `Environment validation failed:\n${missingVars.join('\n')}`
      );
    }
    throw error;
  }
};

// Export typed environment object
export const env = parseEnv();

// Export the schema for testing
export { envSchema };

// Type for the environment object
export type Env = z.infer<typeof envSchema>;
