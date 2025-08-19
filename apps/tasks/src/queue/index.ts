import { Queue, Worker, QueueScheduler } from 'bullmq';
import { env, logger } from '@bharat-agents/shared';
import { getRedisClient } from '../services/redis.js';
import { recordQueueJob } from '../services/metrics.js';
import { jarvis } from '../orchestrator/jarvis.js';
import { AgentKind } from '@bharat-agents/shared';

// =============================================================================
// Redis Connection Configuration
// =============================================================================

const redisClient = getRedisClient();

// =============================================================================
// Queue Definitions
// =============================================================================

// Agent processing queue
export const agentQueue = new Queue('agent-queue', {
  connection: redisClient,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

// Browser automation queue
export const browserQueue = new Queue('browser-queue', {
  connection: redisClient,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

// =============================================================================
// Queue Schedulers
// =============================================================================

export const agentScheduler = new QueueScheduler('agent-queue', {
  connection: redisClient,
});

export const browserScheduler = new QueueScheduler('browser-queue', {
  connection: redisClient,
});

// =============================================================================
// Queue Workers (Enhanced for Agent Execution)
// =============================================================================

// Agent worker - handles GEN, ECHO, and other non-browser agents
type AgentJobData = {
  runId: string;
  nodeId: string;
  agentKind: AgentKind;
  userId: string;
};

export const agentWorker = new Worker<AgentJobData>(
  'agent-queue',
  async job => {
    const startTime = Date.now();

    logger.info(
      {
        jobId: job.id,
        data: job.data,
      },
      'Agent worker processing job'
    );

    try {
      const { runId, nodeId, agentKind, userId } = job.data;

      // Execute the agent using the orchestrator
      const result = await jarvis.executeRunFromQueue(
        runId,
        nodeId,
        agentKind,
        userId
      );

      // Record successful job
      recordQueueJob('agent', 'completed', Date.now() - startTime);

      return result;
    } catch (error) {
      // Record failed job
      recordQueueJob('agent', 'failed', Date.now() - startTime);
      throw error;
    }
  },
  {
    connection: redisClient,
    concurrency: env.AGENT_QUEUE_CONCURRENCY,
  }
);

// Browser worker - handles browser automation
type BrowserJobData = AgentJobData;

export const browserWorker = new Worker<BrowserJobData>(
  'browser-queue',
  async job => {
    const startTime = Date.now();

    logger.info(
      {
        jobId: job.id,
        data: job.data,
      },
      'Browser worker processing job'
    );

    try {
      const { runId, nodeId, agentKind, userId } = job.data;

      // Execute the browser agent using the orchestrator
      const result = await jarvis.executeRunFromQueue(
        runId,
        nodeId,
        agentKind,
        userId
      );

      // Record successful job
      recordQueueJob('browser', 'completed', Date.now() - startTime);

      return result;
    } catch (error) {
      // Record failed job
      recordQueueJob('browser', 'failed', Date.now() - startTime);
      throw error;
    }
  },
  {
    connection: redisClient,
    concurrency: env.BROWSER_QUEUE_CONCURRENCY,
  }
);

// =============================================================================
// Queue Management Functions
// =============================================================================

export const addAgentJob = async (
  data: AgentJobData,
  options?: Parameters<typeof agentQueue.add>[2]
) => {
  return agentQueue.add('process-agent', data, options);
};

export const addBrowserJob = async (
  data: BrowserJobData,
  options?: Parameters<typeof browserQueue.add>[2]
) => {
  return browserQueue.add('process-browser', data, options);
};

export const getQueueStats = async () => {
  const [agentStats, browserStats] = await Promise.all([
    agentQueue.getJobCounts(),
    browserQueue.getJobCounts(),
  ]);

  return {
    agent: agentStats,
    browser: browserStats,
  };
};

// =============================================================================
// Graceful Shutdown
// =============================================================================

export const closeQueues = async () => {
  logger.info('Closing queues...');

  await Promise.all([
    agentQueue.close(),
    browserQueue.close(),
    agentScheduler.close(),
    browserScheduler.close(),
    agentWorker.close(),
    browserWorker.close(),
  ]);

  logger.info('Queues closed');
};

// Handle graceful shutdown
process.on('SIGTERM', closeQueues);
process.on('SIGINT', closeQueues);
