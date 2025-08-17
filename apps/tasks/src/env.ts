import { z } from 'zod';

// =============================================================================
// Environment Schema
// =============================================================================

const envSchema = z.object({
  // Node environment
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  
  // Service configuration
  SERVICE_NAME: z.string().default('tasks'),
  PORT: z.string().transform(val => parseInt(val, 10)).default('3001'),
  
  // Database configuration
  POSTGRES_URL: z.string().url('Invalid PostgreSQL URL').optional(),
  USE_SQLITE: z.string().transform(val => val === 'true').default('false'),
  
  // Redis configuration
  REDIS_URL: z.string().url('Invalid Redis URL').optional(),
  USE_LOCAL_REDIS: z.string().transform(val => val === 'true').default('false'),
  
  // Storage configuration
  S3_ENDPOINT: z.string().url('Invalid S3 endpoint').optional(),
  S3_ACCESS_KEY: z.string().min(1, 'S3 access key is required').optional(),
  S3_SECRET_KEY: z.string().min(1, 'S3 secret key is required').optional(),
  USE_LOCAL_STORAGE: z.string().transform(val => val === 'true').default('false'),
  
  // Security configuration
  JWT_SECRET: z.string().min(32, 'JWT secret must be at least 32 characters'),
  
  // Logging configuration
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  ENABLE_REQUEST_LOGGING: z.string().transform(val => val === 'true').default('true'),
  
  // Development-specific (optional in dev)
  ENABLE_HOT_RELOAD: z.string().transform(val => val === 'true').optional(),
  ENABLE_DETAILED_ERRORS: z.string().transform(val => val === 'true').optional(),
  ENABLE_CORS: z.string().transform(val => val === 'true').optional(),
  CORS_ORIGIN: z.string().optional(),
  
  // Rate limiting
  RATE_LIMIT_MAX: z.string().transform(val => parseInt(val, 10)).optional(),
  
  // LLM configuration
  OPENAI_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  LLM_PROVIDER: z.enum(['openai', 'gemini', 'mock']).optional(),
  LLM_MODEL: z.string().optional(),
  
  // Browser service configuration
  BROWSER_SERVICE_URL: z.string().url('Invalid browser service URL').optional(),
  ALLOW_EVALUATE: z.string().transform(val => val === 'true').default('false'),
  
  // Agent orchestration configuration
  ASYNC_JOBS: z.string().transform(val => val === 'true').default('false'),
  AGENT_NODE_TIMEOUT_MS: z.string().transform(val => parseInt(val, 10)).default('30000'),
  AGENT_RUN_TIMEOUT_MS: z.string().transform(val => parseInt(val, 10)).default('300000'),
  MAX_LLM_CALLS_PER_RUN: z.string().transform(val => parseInt(val, 10)).default('10'),
  MAX_BROWSER_STEPS_PER_RUN: z.string().transform(val => parseInt(val, 10)).default('50'),
  AGENT_QUEUE_CONCURRENCY: z.string().transform(val => parseInt(val, 10)).default('5'),
  BROWSER_QUEUE_CONCURRENCY: z.string().transform(val => parseInt(val, 10)).default('2'),
  
  // Rate limiting configuration
  USER_RATE_LIMIT_PER_MINUTE: z.string().transform(val => parseInt(val, 10)).default('120'),
  USER_MAX_CONCURRENT_RUNS: z.string().transform(val => parseInt(val, 10)).default('3'),
  
  // OpenTelemetry configuration
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url('Invalid OTLP endpoint').optional(),
  OTEL_EXPORTER_OTLP_HEADERS: z.string().optional(),
  
  // Data protection configuration
  ENABLE_ARTIFACT_ENCRYPTION: z.string().transform(val => val === 'true').default('false'),
  MINIO_ENDPOINT: z.string().url('Invalid MinIO endpoint').optional(),
  MINIO_ACCESS_KEY: z.string().optional(),
  MINIO_SECRET_KEY: z.string().optional(),
  MINIO_BUCKET: z.string().optional(),
});

// =============================================================================
// Environment Validation
// =============================================================================

function validateEnvironment() {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const isDev = nodeEnv === 'development';
  const isTest = nodeEnv === 'test';
  
  console.log(`🔧 Validating environment for ${nodeEnv} mode...`);
  
  try {
    // Parse and validate environment variables
    const env = envSchema.parse(process.env);
    
    // Additional validation for production
    if (!isDev && !isTest) {
      console.log('🚨 Production environment detected - enforcing strict validation');
      
      // Ensure all required production variables are set
      const requiredForProd = [
        'JWT_SECRET'
      ];
      
      // Check database configuration
      if (!env.USE_SQLITE && !env.POSTGRES_URL) {
        throw new Error('Either USE_SQLITE=true or POSTGRES_URL must be set');
      }
      
      // Check Redis configuration
      if (!env.USE_LOCAL_REDIS && !env.REDIS_URL) {
        throw new Error('Either USE_LOCAL_REDIS=true or REDIS_URL must be set');
      }
      
      // Check storage configuration
      if (!env.USE_LOCAL_STORAGE && (!env.S3_ENDPOINT || !env.S3_ACCESS_KEY || !env.S3_SECRET_KEY)) {
        throw new Error('Either USE_LOCAL_STORAGE=true or S3 configuration must be complete');
      }
      
      for (const key of requiredForProd) {
        if (!process.env[key]) {
          throw new Error(`Missing required environment variable: ${key}`);
        }
      }
      
      // Validate JWT secret strength in production
      if (env.JWT_SECRET.length < 32) {
        throw new Error('JWT_SECRET must be at least 32 characters in production');
      }
      
      // Validate S3 configuration if using S3
      if (!env.USE_LOCAL_STORAGE && env.S3_ENDPOINT && !env.S3_ENDPOINT.startsWith('http')) {
        throw new Error('S3_ENDPOINT must be a valid HTTP/HTTPS URL');
      }
    }
    
    console.log('✅ Environment validation passed');
    return env;
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Environment validation failed:');
      error.errors.forEach(err => {
        console.error(`   ${err.path.join('.')}: ${err.message}`);
      });
    } else {
      console.error('❌ Environment validation failed:', error instanceof Error ? error.message : error);
    }
    
    console.error('\n📋 Required environment variables:');
    console.error('   JWT_SECRET - JWT signing secret (min 32 chars)');
    console.error('\n📋 Database configuration (choose one):');
    console.error('   USE_SQLITE=true - Use local SQLite database (recommended for dev)');
    console.error('   POSTGRES_URL - PostgreSQL connection string (for production)');
    console.error('\n📋 Redis configuration (choose one):');
    console.error('   USE_LOCAL_REDIS=true - Use local Redis (recommended for dev)');
    console.error('   REDIS_URL - Redis connection string (for production)');
    console.error('\n📋 Storage configuration (choose one):');
    console.error('   USE_LOCAL_STORAGE=true - Use local file storage (recommended for dev)');
    console.error('   S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY - S3 configuration (for production)');
    console.error('\n📋 LLM configuration:');
    console.error('   GEMINI_API_KEY - Google Gemini API key (recommended for dev)');
    console.error('   OPENAI_API_KEY - OpenAI API key (alternative)');
    console.error('\n📋 Optional environment variables:');
    console.error('   PORT - Service port (default: 3001)');
    console.error('   LOG_LEVEL - Log level (default: info)');
    console.error('   RATE_LIMIT_MAX - Rate limit per minute (default: 60)');
    
    process.exit(1);
  }
}

// =============================================================================
// Export
// =============================================================================

export const env = validateEnvironment();
export type Env = typeof env;
