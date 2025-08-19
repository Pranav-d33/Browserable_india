import { env } from '../env';
import { logger } from '@bharat-agents/shared';
import { sqliteDb } from './sqlite';
import type { JsonValue } from '@bharat-agents/shared';
import { db as prismaDb } from './client';

// =============================================================================
// Database Adapter Interface
// =============================================================================

export interface DatabaseAdapter {
  // Task operations
  createTask(task: {
    id: string;
    name: string;
    description?: string;
    status?: string;
    data?: JsonValue;
  }): Promise<void>;

  getTask(id: string): Promise<JsonValue | null>;

  updateTask(
    id: string,
    updates: Partial<{
      name: string;
      description: string;
      status: string;
      data: JsonValue;
    }>
  ): Promise<void>;

  listTasks(limit?: number, offset?: number): Promise<JsonValue[]>;

  deleteTask(id: string): Promise<void>;

  // Run operations
  createRun(run: {
    id: string;
    taskId: string;
    status?: string;
    data?: JsonValue;
  }): Promise<void>;

  getRun(id: string): Promise<JsonValue | null>;

  updateRun(
    id: string,
    updates: Partial<{
      status: string;
      data: JsonValue;
      result: JsonValue;
      error: string;
    }>
  ): Promise<void>;

  listRuns(
    taskId?: string,
    limit?: number,
    offset?: number
  ): Promise<JsonValue[]>;

  // Agent operations
  createAgent(agent: {
    id: string;
    name: string;
    type: string;
    config?: JsonValue;
  }): Promise<void>;

  getAgent(id: string): Promise<JsonValue | null>;

  listAgents(type?: string): Promise<JsonValue[]>;

  // Browser agent operations
  createBrowserAgent(agent: {
    id: string;
    name: string;
    description?: string;
    config?: JsonValue;
  }): Promise<void>;

  getBrowserAgent(id: string): Promise<JsonValue | null>;

  listBrowserAgents(): Promise<JsonValue[]>;

  // Flow operations
  createFlow(flow: {
    id: string;
    name: string;
    description?: string;
    config?: JsonValue;
  }): Promise<void>;

  getFlow(id: string): Promise<JsonValue | null>;

  listFlows(): Promise<JsonValue[]>;

  // Artifact operations
  createArtifact(artifact: {
    id: string;
    runId: string;
    name: string;
    type: string;
    data?: JsonValue;
  }): Promise<void>;

  getArtifact(id: string): Promise<JsonValue | null>;

  listArtifacts(runId: string): Promise<JsonValue[]>;

  // Utility methods
  transaction<T>(fn: () => T): Promise<T>;

  close(): Promise<void>;

  healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; error?: string }>;
}

// =============================================================================
// Prisma Database Adapter
// =============================================================================

class PrismaAdapter implements DatabaseAdapter {
  async createTask(task: {
    id: string;
    name: string;
    description?: string;
    status?: string;
    data?: JsonValue;
  }): Promise<void> {
    await prismaDb.task.create({
      data: {
        id: task.id,
        name: task.name,
        description: task.description,
        status: task.status || 'pending',
        data: task.data,
      },
    });
  }

  async getTask(id: string): Promise<JsonValue | null> {
    return await prismaDb.task.findUnique({
      where: { id },
    });
  }

  async updateTask(
    id: string,
    updates: Partial<{
      name: string;
      description: string;
      status: string;
      data: JsonValue;
    }>
  ): Promise<void> {
    await prismaDb.task.update({
      where: { id },
      data: {
        ...updates,
        updatedAt: new Date(),
      },
    });
  }

  async listTasks(
    limit: number = 100,
    offset: number = 0
  ): Promise<JsonValue[]> {
    return await prismaDb.task.findMany({
      take: limit,
      skip: offset,
      orderBy: { createdAt: 'desc' },
    });
  }

  async deleteTask(id: string): Promise<void> {
    await prismaDb.task.delete({
      where: { id },
    });
  }

  async createRun(run: {
    id: string;
    taskId: string;
    status?: string;
    data?: JsonValue;
  }): Promise<void> {
    await prismaDb.run.create({
      data: {
        id: run.id,
        taskId: run.taskId,
        status: run.status || 'running',
        data: run.data,
      },
    });
  }

  async getRun(id: string): Promise<JsonValue | null> {
    return await prismaDb.run.findUnique({
      where: { id },
    });
  }

  async updateRun(
    id: string,
    updates: Partial<{
      status: string;
      data: JsonValue;
      result: JsonValue;
      error: string;
    }>
  ): Promise<void> {
    const updateData: Record<string, unknown> = { ...updates };

    if (updates.status === 'completed' || updates.status === 'failed') {
      updateData.completedAt = new Date();
    }

    await prismaDb.run.update({
      where: { id },
      data: updateData,
    });
  }

  async listRuns(
    taskId?: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<JsonValue[]> {
    const where = taskId ? { taskId } : {};

    return await prismaDb.run.findMany({
      where,
      take: limit,
      skip: offset,
      orderBy: { startedAt: 'desc' },
    });
  }

  async createAgent(agent: {
    id: string;
    name: string;
    type: string;
    config?: JsonValue;
  }): Promise<void> {
    await prismaDb.agent.create({
      data: {
        id: agent.id,
        name: agent.name,
        type: agent.type,
        config: agent.config,
      },
    });
  }

  async getAgent(id: string): Promise<JsonValue | null> {
    return await prismaDb.agent.findUnique({
      where: { id },
    });
  }

  async listAgents(type?: string): Promise<JsonValue[]> {
    const where = type ? { type } : {};

    return await prismaDb.agent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async createBrowserAgent(agent: {
    id: string;
    name: string;
    description?: string;
    config?: JsonValue;
  }): Promise<void> {
    await prismaDb.browserAgent.create({
      data: {
        id: agent.id,
        name: agent.name,
        description: agent.description,
        config: agent.config,
      },
    });
  }

  async getBrowserAgent(id: string): Promise<JsonValue | null> {
    return await prismaDb.browserAgent.findUnique({
      where: { id },
    });
  }

  async listBrowserAgents(): Promise<JsonValue[]> {
    return await prismaDb.browserAgent.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async createFlow(flow: {
    id: string;
    name: string;
    description?: string;
    config?: JsonValue;
  }): Promise<void> {
    await prismaDb.flow.create({
      data: {
        id: flow.id,
        name: flow.name,
        description: flow.description,
        config: flow.config,
      },
    });
  }

  async getFlow(id: string): Promise<JsonValue | null> {
    return await prismaDb.flow.findUnique({
      where: { id },
    });
  }

  async listFlows(): Promise<JsonValue[]> {
    return await prismaDb.flow.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async createArtifact(artifact: {
    id: string;
    runId: string;
    name: string;
    type: string;
    data?: JsonValue;
  }): Promise<void> {
    await prismaDb.artifact.create({
      data: {
        id: artifact.id,
        runId: artifact.runId,
        name: artifact.name,
        type: artifact.type,
        data: artifact.data,
      },
    });
  }

  async getArtifact(id: string): Promise<JsonValue | null> {
    return await prismaDb.artifact.findUnique({
      where: { id },
    });
  }

  async listArtifacts(runId: string): Promise<JsonValue[]> {
    return await prismaDb.artifact.findMany({
      where: { runId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async transaction<T>(fn: () => T): Promise<T> {
    return await prismaDb.$transaction(fn);
  }

  async close(): Promise<void> {
    await prismaDb.$disconnect();
  }

  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    error?: string;
  }> {
    try {
      await prismaDb.$queryRaw`SELECT 1`;
      return { status: 'healthy' };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

// =============================================================================
// Database Adapter Factory
// =============================================================================

class DatabaseAdapterFactory {
  private static instance: DatabaseAdapter | null = null;

  static getInstance(): DatabaseAdapter {
    if (!this.instance) {
      if (env.USE_SQLITE) {
        logger.info('Using SQLite database adapter');
        this.instance = sqliteDb;
      } else {
        logger.info('Using Prisma/PostgreSQL database adapter');
        this.instance = new PrismaAdapter();
      }
    }

    return this.instance!;
  }

  static async initialize(): Promise<void> {
    const adapter = this.getInstance();

    // Test the connection
    const health = await adapter.healthCheck();
    if (health.status === 'unhealthy') {
      throw new Error(`Database health check failed: ${health.error}`);
    }

    logger.info('Database adapter initialized successfully');
  }

  static async close(): Promise<void> {
    if (this.instance) {
      await this.instance.close();
      this.instance = null;
    }
  }
}

// Export the factory and convenience function
export { DatabaseAdapterFactory };
export const getDb = () => DatabaseAdapterFactory.getInstance();
