import { db } from '../db/client.js';
import { checkRedisHealth } from './redis.js';
import { logger } from '@bharat-agents/shared';

// =============================================================================
// Health Check System
// =============================================================================

export interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  uptime: number;
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  cpu: {
    load: number;
    cores: number;
  };
  database: {
    status: 'connected' | 'disconnected';
    responseTime: number;
  };
  redis: {
    status: 'connected' | 'disconnected';
    responseTime: number;
  };
  pressure: {
    memoryPressure: boolean;
    cpuPressure: boolean;
    databasePressure: boolean;
    redisPressure: boolean;
  };
}

// =============================================================================
// Pressure Thresholds
// =============================================================================

const PRESSURE_THRESHOLDS = {
  MEMORY_USAGE_PERCENT: 85, // 85% memory usage
  CPU_LOAD_AVERAGE: 0.8,    // 80% CPU load
  DB_RESPONSE_TIME_MS: 1000, // 1 second
  REDIS_RESPONSE_TIME_MS: 100, // 100ms
};

// =============================================================================
// Health Check Functions
// =============================================================================

async function checkDatabaseHealth(): Promise<{ status: 'connected' | 'disconnected'; responseTime: number }> {
  const startTime = Date.now();
  
  try {
    await db.$queryRaw`SELECT 1`;
    const responseTime = Date.now() - startTime;
    
    return {
      status: 'connected',
      responseTime,
    };
  } catch (error) {
    logger.error({ error }, 'Database health check failed');
    return {
      status: 'disconnected',
      responseTime: Date.now() - startTime,
    };
  }
}

async function checkRedisHealthWithTiming(): Promise<{ status: 'connected' | 'disconnected'; responseTime: number }> {
  const startTime = Date.now();
  
  try {
    const isHealthy = await checkRedisHealth();
    const responseTime = Date.now() - startTime;
    
    return {
      status: isHealthy ? 'connected' : 'disconnected',
      responseTime,
    };
  } catch (error) {
    logger.error({ error }, 'Redis health check failed');
    return {
      status: 'disconnected',
      responseTime: Date.now() - startTime,
    };
  }
}

function getMemoryUsage() {
  const memUsage = process.memoryUsage();
  const total = memUsage.heapTotal;
  const used = memUsage.heapUsed;
  const percentage = (used / total) * 100;
  
  return {
    used: Math.round(used / 1024 / 1024), // MB
    total: Math.round(total / 1024 / 1024), // MB
    percentage: Math.round(percentage * 100) / 100,
  };
}

function getCpuLoad(): { load: number; cores: number } {
  // Simple CPU load calculation based on uptime
  const uptime = process.uptime();
  const load = Math.min(uptime / 100, 1); // Simple approximation
  
  return {
    load: Math.round(load * 100) / 100,
    cores: require('os').cpus().length,
  };
}

// =============================================================================
// Pressure Detection
// =============================================================================

function detectPressure(healthData: Omit<HealthStatus, 'pressure'>): HealthStatus['pressure'] {
  const memory = healthData.memory;
  const cpu = healthData.cpu;
  const database = healthData.database;
  const redis = healthData.redis;
  
  return {
    memoryPressure: memory.percentage > PRESSURE_THRESHOLDS.MEMORY_USAGE_PERCENT,
    cpuPressure: cpu.load > PRESSURE_THRESHOLDS.CPU_LOAD_AVERAGE,
    databasePressure: database.responseTime > PRESSURE_THRESHOLDS.DB_RESPONSE_TIME_MS,
    redisPressure: redis.responseTime > PRESSURE_THRESHOLDS.REDIS_RESPONSE_TIME_MS,
  };
}

// =============================================================================
// Main Health Check Function
// =============================================================================

export async function performHealthCheck(): Promise<HealthStatus> {
  const startTime = Date.now();
  
  // Parallel health checks
  const [databaseHealth, redisHealth] = await Promise.all([
    checkDatabaseHealth(),
    checkRedisHealthWithTiming(),
  ]);
  
  const memory = getMemoryUsage();
  const cpu = getCpuLoad();
  
  const healthData: Omit<HealthStatus, 'pressure'> = {
    status: 'healthy', // Will be updated based on pressure
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory,
    cpu,
    database: databaseHealth,
    redis: redisHealth,
  };
  
  // Detect pressure
  const pressure = detectPressure(healthData);
  
  // Determine overall status
  let status: HealthStatus['status'] = 'healthy';
  
  if (databaseHealth.status === 'disconnected' || redisHealth.status === 'disconnected') {
    status = 'unhealthy';
  } else if (pressure.memoryPressure || pressure.cpuPressure || pressure.databasePressure || pressure.redisPressure) {
    status = 'degraded';
  }
  
  const result: HealthStatus = {
    ...healthData,
    status,
    pressure,
  };
  
  const totalTime = Date.now() - startTime;
  logger.debug({ healthCheck: result, duration: totalTime }, 'Health check completed');
  
  return result;
}

// =============================================================================
// Pressure Monitoring
// =============================================================================

let pressureMonitoringInterval: NodeJS.Timeout | null = null;

export function startPressureMonitoring(intervalMs: number = 30000) {
  if (pressureMonitoringInterval) {
    clearInterval(pressureMonitoringInterval);
  }
  
  pressureMonitoringInterval = setInterval(async () => {
    try {
      const health = await performHealthCheck();
      
      if (health.status === 'unhealthy') {
        logger.error({ health }, 'System is unhealthy');
      } else if (health.status === 'degraded') {
        logger.warn({ health }, 'System is under pressure');
      }
      
      // Log pressure indicators
      if (health.pressure.memoryPressure) {
        logger.warn({ memoryUsage: health.memory }, 'High memory usage detected');
      }
      
      if (health.pressure.cpuPressure) {
        logger.warn({ cpuLoad: health.cpu }, 'High CPU load detected');
      }
      
      if (health.pressure.databasePressure) {
        logger.warn({ dbResponseTime: health.database.responseTime }, 'Database response time high');
      }
      
      if (health.pressure.redisPressure) {
        logger.warn({ redisResponseTime: health.redis.responseTime }, 'Redis response time high');
      }
      
    } catch (error) {
      logger.error({ error }, 'Pressure monitoring failed');
    }
  }, intervalMs);
  
  logger.info({ intervalMs }, 'Pressure monitoring started');
}

export function stopPressureMonitoring() {
  if (pressureMonitoringInterval) {
    clearInterval(pressureMonitoringInterval);
    pressureMonitoringInterval = null;
    logger.info('Pressure monitoring stopped');
  }
}
