import { config } from 'dotenv-flow';
import { z } from 'zod';

// Load environment variables from .env files (only if not in test environment)
if (process.env.NODE_ENV !== 'test') {
  config();
}

// Environment schema validation
const envSchema = z.object({
  // Database
  POSTGRES_URL: z.string().url('POSTGRES_URL must be a valid URL'),

  // Cache
  REDIS_URL: z.string().url('REDIS_URL must be a valid URL'),

  // Storage
  S3_ENDPOINT: z.string().url('S3_ENDPOINT must be a valid URL'),
  S3_ACCESS_KEY: z.string().min(1, 'S3_ACCESS_KEY is required'),
  S3_SECRET_KEY: z.string().min(1, 'S3_SECRET_KEY is required'),

  // Security
  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET must be at least 32 characters long'),
  JWT_ISSUER: z.string().optional(),
  JWT_AUDIENCE: z.string().optional(),
  ALLOW_INSECURE_DEV: z.string().optional(),

  // AI/ML (optional in Phase 0)
  OPENAI_API_KEY: z.string().optional(),

  // Application
  NODE_ENV: z
    .enum(['development', 'production', 'test'], {
      errorMap: () => ({
        message: 'NODE_ENV must be development, production, or test',
      }),
    })
    .default('development'),

  PORT: z
    .string()
    .refine(val => {
      const num = parseInt(val, 10);
      return !isNaN(num) && num > 0 && num.toString() === val;
    }, 'PORT must be a valid positive integer')
    .transform(val => parseInt(val, 10))
    .default('3000'),

  // Service information
  SERVICE_NAME: z.string().optional(),
  SERVICE_VERSION: z.string().optional(),

  // OpenTelemetry
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),
  OTEL_EXPORTER_OTLP_HEADERS: z.string().optional(),
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

// Export typed environment object (only if not in test environment)
export const env: z.infer<typeof envSchema> | Record<string, never> =
  process.env.NODE_ENV === 'test' ? ({} as Record<string, never>) : parseEnv();

// Export the schema for testing
export { envSchema };

// Type for the environment object
export type Env = z.infer<typeof envSchema>;
