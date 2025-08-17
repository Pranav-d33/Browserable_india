import { 
  AgentKind, 
  AgentRunStatus, 
  AgentNodeStatus,
  type Agent,
  type AgentRun,
  type AgentNodeExecution,
  type AgentRunInput,
  type AgentRunOutput,
  createAgentRun,
  createAgentNodeExecution,
  generateAgentRunId,
  generateAgentNodeId,
  isAgentRunTerminal,
  isAgentNodeTerminal,
  calculateAgentRunDuration,
} from '@bharat-agents/shared';
import { logger } from '@bharat-agents/shared';
import { env } from '../env.js';
import { addAgentJob, addBrowserJob } from '../queue/index.js';
import { recordAgentRun, recordAgentNode } from '../services/metrics.js';
import { getCurrentUserId } from '../security/auth.js';

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

export interface CreateRunRequest {
  userId: string;
  input: AgentRunInput;
  agent?: AgentKind;
  options?: {
    timeout?: number;
    priority?: 'low' | 'normal' | 'high';
    tags?: string[];
    metadata?: Record<string, unknown>;
  };
}

export interface CreateRunResponse {
  runId: string;
  status: AgentRunStatus;
  output?: AgentRunOutput;
  error?: string;
}

export interface AgentHandler {
  execute(run: AgentRun, node: AgentNodeExecution): Promise<AgentRunOutput>;
}

export interface RunLimits {
  maxLlmCalls: number;
  maxBrowserSteps: number;
  nodeTimeout: number;
  runTimeout: number;
}

// =============================================================================
// AGENT SELECTION HEURISTICS
// =============================================================================

const BROWSER_KEYWORDS = ['open', 'click', 'visit', 'navigate', 'browse', 'web', 'url', 'page', 'site', 'website'];

export function selectAgentByHeuristics(input: AgentRunInput): AgentKind {
  const prompt = input.prompt?.toLowerCase() || '';
  const data = JSON.stringify(input.data || {}).toLowerCase();
  const context = JSON.stringify(input.context || {}).toLowerCase();
  
  const combinedText = `${prompt} ${data} ${context}`;
  
  // Check for browser-related keywords
  const hasBrowserKeywords = BROWSER_KEYWORDS.some(keyword => 
    combinedText.includes(keyword)
  );
  
  if (hasBrowserKeywords) {
    logger.debug('Selected BROWSER agent based on keywords', { keywords: BROWSER_KEYWORDS.filter(k => combinedText.includes(k)) });
    return AgentKind.BROWSER;
  }
  
  // Default to GEN agent for text generation tasks
  logger.debug('Selected GEN agent as default');
  return AgentKind.GEN;
}

// =============================================================================
// AGENT HANDLERS (Factory Pattern)
// =============================================================================

/**
 * ECHO Agent Handler - Phase 0 Implementation
 * Simply returns the input as output
 */
class EchoAgentHandler implements AgentHandler {
  async execute(run: AgentRun, node: AgentNodeExecution): Promise<AgentRunOutput> {
    logger.info(`Echo agent executing run ${run.id}, node ${node.id}`);
    
    // Simulate some processing time
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return {
      result: run.input,
      metadata: {
        agentType: 'ECHO',
        processedAt: new Date().toISOString(),
        inputSize: JSON.stringify(run.input).length,
      },
      usage: {
        duration: 100, // milliseconds
      },
    };
  }
}

/**
 * Browser Agent Handler - Enhanced with limits and timeouts
 */
class BrowserAgentHandler implements AgentHandler {
  private stepCount = 0;
  private readonly maxSteps: number;

  constructor(maxSteps: number = env.MAX_BROWSER_STEPS_PER_RUN) {
    this.maxSteps = maxSteps;
  }

  async execute(run: AgentRun, node: AgentNodeExecution): Promise<AgentRunOutput> {
    logger.info(`Browser agent executing run ${run.id}, node ${node.id}`);
    
    // Reset step count for new execution
    this.stepCount = 0;
    
    // TODO: Implement actual browser automation in Phase 1
    // For now, simulate browser steps with limits
    const steps = this.simulateBrowserSteps(run.input);
    
    return {
      result: {
        steps: steps,
        totalSteps: this.stepCount,
        maxSteps: this.maxSteps,
      },
      metadata: {
        agentType: 'BROWSER',
        processedAt: new Date().toISOString(),
        stepsExecuted: this.stepCount,
      },
      usage: {
        duration: this.stepCount * 100, // 100ms per step
      },
    };
  }

  private simulateBrowserSteps(input: AgentRunInput): string[] {
    const steps: string[] = [];
    const prompt = input.prompt?.toLowerCase() || '';
    
    // Simulate steps based on input
    if (prompt.includes('open') || prompt.includes('visit')) {
      if (this.stepCount >= this.maxSteps) {
        throw new Error(`Browser step limit exceeded: ${this.maxSteps}`);
      }
      steps.push('navigate_to_page');
      this.stepCount++;
    }
    
    if (prompt.includes('click')) {
      if (this.stepCount >= this.maxSteps) {
        throw new Error(`Browser step limit exceeded: ${this.maxSteps}`);
      }
      steps.push('click_element');
      this.stepCount++;
    }
    
    if (prompt.includes('type') || prompt.includes('input')) {
      if (this.stepCount >= this.maxSteps) {
        throw new Error(`Browser step limit exceeded: ${this.maxSteps}`);
      }
      steps.push('type_text');
      this.stepCount++;
    }
    
    return steps;
  }
}

/**
 * Gen Agent Handler - Enhanced with LLM call limits
 */
class GenAgentHandler implements AgentHandler {
  private llmCallCount = 0;
  private readonly maxLlmCalls: number;

  constructor(maxLlmCalls: number = env.MAX_LLM_CALLS_PER_RUN) {
    this.maxLlmCalls = maxLlmCalls;
  }

  async execute(run: AgentRun, node: AgentNodeExecution): Promise<AgentRunOutput> {
    logger.info(`Gen agent executing run ${run.id}, node ${node.id}`);
    
    // Reset call count for new execution
    this.llmCallCount = 0;
    
    // TODO: Implement actual LLM calls in Phase 1
    // For now, simulate LLM calls with limits
    const result = await this.simulateLlmCalls(run.input);
    
    return {
      result: result,
      metadata: {
        agentType: 'GEN',
        processedAt: new Date().toISOString(),
        llmCalls: this.llmCallCount,
      },
      usage: {
        duration: this.llmCallCount * 200, // 200ms per LLM call
      },
    };
  }

  private async simulateLlmCalls(input: AgentRunInput): Promise<string> {
    const prompt = input.prompt || 'Generate some text';
    
    // Simulate LLM calls based on input complexity
    const words = prompt.split(' ').length;
    const estimatedCalls = Math.min(Math.ceil(words / 10), 3); // 1 call per 10 words, max 3
    
    for (let i = 0; i < estimatedCalls; i++) {
      if (this.llmCallCount >= this.maxLlmCalls) {
        throw new Error(`LLM call limit exceeded: ${this.maxLlmCalls}`);
      }
      
      // Simulate LLM call
      await new Promise(resolve => setTimeout(resolve, 200));
      this.llmCallCount++;
    }
    
    return `Generated response for: "${prompt}" (${this.llmCallCount} LLM calls used)`;
  }
}

// =============================================================================
// AGENT HANDLER FACTORY
// =============================================================================

class AgentHandlerFactory {
  private static handlers = new Map<AgentKind, AgentHandler>();

  static getHandler(agentKind: AgentKind): AgentHandler {
    const handler = this.handlers.get(agentKind);
    if (!handler) {
      throw new Error(`No handler found for agent kind: ${agentKind}`);
    }
    return handler;
  }

  static registerHandler(agentKind: AgentKind, handler: AgentHandler): void {
    this.handlers.set(agentKind, handler);
    logger.info(`Registered handler for agent kind: ${agentKind}`);
  }

  static isSupported(agentKind: AgentKind): boolean {
    return this.handlers.has(agentKind);
  }

  static getSupportedAgents(): AgentKind[] {
    return Array.from(this.handlers.keys());
  }

  static initialize(): void {
    // Register handlers with limits
    this.registerHandler(AgentKind.ECHO, new EchoAgentHandler());
    this.registerHandler(AgentKind.BROWSER, new BrowserAgentHandler());
    this.registerHandler(AgentKind.GEN, new GenAgentHandler());
    
    logger.info('Agent handlers initialized with limits');
  }
}

// =============================================================================
// IN-MEMORY STORAGE (Enhanced with RBAC)
// =============================================================================

class InMemoryStorage {
  private runs = new Map<string, AgentRun>();
  private nodes = new Map<string, AgentNodeExecution>();

  async saveRun(run: AgentRun): Promise<void> {
    this.runs.set(run.id, run);
    logger.debug(`Saved run ${run.id} to in-memory storage`);
  }

  async saveNode(node: AgentNodeExecution): Promise<void> {
    this.nodes.set(node.id, node);
    logger.debug(`Saved node ${node.id} to in-memory storage`);
  }

  async getRun(runId: string): Promise<AgentRun | null> {
    return this.runs.get(runId) || null;
  }

  async getNode(nodeId: string): Promise<AgentNodeExecution | null> {
    return this.nodes.get(nodeId) || null;
  }

  async updateRun(runId: string, updates: Partial<AgentRun>): Promise<void> {
    const run = this.runs.get(runId);
    if (run) {
      Object.assign(run, updates);
      this.runs.set(runId, run);
      logger.debug(`Updated run ${runId} in in-memory storage`);
    }
  }

  async updateNode(nodeId: string, updates: Partial<AgentNodeExecution>): Promise<void> {
    const node = this.nodes.get(nodeId);
    if (node) {
      Object.assign(node, updates);
      this.nodes.set(nodeId, node);
      logger.debug(`Updated node ${nodeId} in in-memory storage`);
    }
  }

  async listRuns(limit: number = 100): Promise<AgentRun[]> {
    return Array.from(this.runs.values())
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
      .slice(0, limit);
  }

  async listRunsByUser(userId: string, limit: number = 100): Promise<AgentRun[]> {
    return Array.from(this.runs.values())
      .filter(run => run.metadata.userId === userId)
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
      .slice(0, limit);
  }

  async listRunsByAgent(agentId: string, limit: number = 100): Promise<AgentRun[]> {
    return Array.from(this.runs.values())
      .filter(run => run.agentId === agentId)
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
      .slice(0, limit);
  }
}

// =============================================================================
// JARVIS ORCHESTRATOR (Enhanced)
// =============================================================================

export class JarvisOrchestrator {
  private storage: InMemoryStorage;

  constructor() {
    this.storage = new InMemoryStorage();
    AgentHandlerFactory.initialize();
    logger.info('Jarvis orchestrator initialized with enhanced features');
  }

  /**
   * Get run limits based on environment configuration
   */
  private getRunLimits(): RunLimits {
    return {
      maxLlmCalls: env.MAX_LLM_CALLS_PER_RUN,
      maxBrowserSteps: env.MAX_BROWSER_STEPS_PER_RUN,
      nodeTimeout: env.AGENT_NODE_TIMEOUT_MS,
      runTimeout: env.AGENT_RUN_TIMEOUT_MS,
    };
  }

  /**
   * Handle creation and execution of agent runs with enhanced features
   */
  async handleCreateRun(request: CreateRunRequest): Promise<CreateRunResponse> {
    const { userId, input, agent, options } = request;
    
    try {
      // Determine agent type if not specified
      const selectedAgent = agent || selectAgentByHeuristics(input);
      
      logger.info(`Creating run for agent ${selectedAgent} by user ${userId}`, {
        agentSpecified: !!agent,
        selectedAgent,
        asyncJobs: env.ASYNC_JOBS,
      });

      // Validate agent is supported
      if (!AgentHandlerFactory.isSupported(selectedAgent)) {
        throw new Error(`Agent kind ${selectedAgent} is not supported`);
      }

      // Create run with RBAC metadata
      const run = createAgentRun(`agent_${selectedAgent.toLowerCase()}`, input, {
        userId,
        agentKind: selectedAgent,
        agentName: `${selectedAgent} Agent`,
        agentVersion: '1.0.0',
        ...options?.metadata,
      });

      // Create execution node
      const node = createAgentNodeExecution(
        `${selectedAgent.toLowerCase()}_execution`,
        selectedAgent.toLowerCase(),
        { input: run.input },
        1 // maxAttempts
      );

      // Save to storage
      await this.storage.saveRun(run);
      await this.storage.saveNode(node);

      // Add node to run
      run.nodes.push(node);
      await this.storage.updateRun(run.id, { nodes: run.nodes });

      // Handle async vs sync execution
      if (env.ASYNC_JOBS) {
        return await this.handleAsyncExecution(run, node, selectedAgent);
      } else {
        return await this.handleSyncExecution(run, node, selectedAgent);
      }

    } catch (error) {
      logger.error('Error creating run:', error);
      throw error;
    }
  }

  /**
   * Handle async execution using BullMQ
   */
  private async handleAsyncExecution(
    run: AgentRun, 
    node: AgentNodeExecution, 
    agentKind: AgentKind
  ): Promise<CreateRunResponse> {
    try {
      // Add job to appropriate queue
      const queue = agentKind === AgentKind.BROWSER ? addBrowserJob : addAgentJob;
      const job = await queue({
        runId: run.id,
        nodeId: node.id,
        agentKind,
        input: run.input,
        userId: run.metadata.userId as string,
      }, {
        priority: 'normal',
        delay: 0,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      });

      logger.info(`Queued async job for run ${run.id}`, { jobId: job.id });

      // Record metrics
      recordAgentRun(agentKind, AgentRunStatus.PENDING);

      return {
        runId: run.id,
        status: AgentRunStatus.PENDING,
      };

    } catch (error) {
      logger.error(`Error queuing async job for run ${run.id}:`, error);
      
      // Update run with error
      run.status = AgentRunStatus.FAILED;
      run.error = {
        code: 'QUEUE_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      };
      await this.storage.updateRun(run.id, { status: run.status, error: run.error });

      // Record metrics
      recordAgentRun(agentKind, AgentRunStatus.FAILED);

      throw error;
    }
  }

  /**
   * Handle sync execution with timeouts and limits
   */
  async handleSyncExecution(
    run: AgentRun, 
    node: AgentNodeExecution, 
    agentKind: AgentKind
  ): Promise<CreateRunResponse> {
    const limits = this.getRunLimits();
    const startTime = Date.now();

    try {
      // Update run status to running
      run.status = AgentRunStatus.RUNNING;
      await this.storage.updateRun(run.id, { status: run.status });

      // Update node status to running
      node.status = AgentNodeStatus.RUNNING;
      node.startedAt = new Date();
      await this.storage.updateNode(node.id, { 
        status: node.status, 
        startedAt: node.startedAt 
      });

      logger.info(`Executing run ${run.id}, node ${node.id} with timeout ${limits.nodeTimeout}ms`);

      // Execute with timeout
      const output = await Promise.race([
        this.executeWithLimits(run, node, agentKind, limits),
        this.createTimeout(limits.nodeTimeout, `Node execution timeout: ${limits.nodeTimeout}ms`)
      ]);

      // Update node with success
      node.status = AgentNodeStatus.COMPLETED;
      node.completedAt = new Date();
      node.output = output;
      node.duration = Date.now() - startTime;
      await this.storage.updateNode(node.id, {
        status: node.status,
        completedAt: node.completedAt,
        output: node.output,
        duration: node.duration,
      });

      // Update run with success
      run.status = AgentRunStatus.COMPLETED;
      run.completedAt = new Date();
      run.output = output;
      run.duration = calculateAgentRunDuration(run);
      await this.storage.updateRun(run.id, {
        status: run.status,
        completedAt: run.completedAt,
        output: run.output,
        duration: run.duration,
      });

      // Record metrics
      recordAgentRun(agentKind, AgentRunStatus.COMPLETED, run.duration);
      recordAgentNode(agentKind, node.type, node.duration || 0);

      logger.info(`Run ${run.id} completed successfully in ${run.duration}ms`);

      return {
        runId: run.id,
        status: run.status,
        output: run.output,
      };

    } catch (error) {
      logger.error(`Error executing run ${run.id}:`, error);

      const duration = Date.now() - startTime;

      // Update node with error
      node.status = AgentNodeStatus.FAILED;
      node.completedAt = new Date();
      node.error = {
        code: 'EXECUTION_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: { stack: error instanceof Error ? error.stack : undefined },
      };
      node.duration = duration;
      await this.storage.updateNode(node.id, {
        status: node.status,
        completedAt: node.completedAt,
        error: node.error,
        duration: node.duration,
      });

      // Update run with error
      run.status = AgentRunStatus.FAILED;
      run.completedAt = new Date();
      run.error = {
        code: 'EXECUTION_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: { stack: error instanceof Error ? error.stack : undefined },
      };
      run.duration = calculateAgentRunDuration(run);
      await this.storage.updateRun(run.id, {
        status: run.status,
        completedAt: run.completedAt,
        error: run.error,
        duration: run.duration,
      });

      // Record metrics
      recordAgentRun(agentKind, AgentRunStatus.FAILED, duration);
      recordAgentNode(agentKind, node.type, duration);

      return {
        runId: run.id,
        status: run.status,
        error: run.error?.message,
      };
    }
  }

  /**
   * Execute a run from queue worker (public method for queue integration)
   */
  async executeRunFromQueue(runId: string, nodeId: string, agentKind: AgentKind, userId: string): Promise<CreateRunResponse> {
    const run = await this.getRun(runId, userId);
    if (!run) {
      throw new Error(`Run ${runId} not found`);
    }
    
    const node = await this.getNode(nodeId);
    if (!node) {
      throw new Error(`Node ${nodeId} not found`);
    }
    
    return await this.handleSyncExecution(run, node, agentKind);
  }

  /**
   * Execute agent with limits enforcement
   */
  private async executeWithLimits(
    run: AgentRun, 
    node: AgentNodeExecution, 
    agentKind: AgentKind, 
    limits: RunLimits
  ): Promise<AgentRunOutput> {
    // Get appropriate handler
    const handler = AgentHandlerFactory.getHandler(agentKind);

    // Execute the agent
    return await handler.execute(run, node);
  }

  /**
   * Create a timeout promise
   */
  private createTimeout(ms: number, message: string): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), ms);
    });
  }

  /**
   * Get run by ID with RBAC enforcement
   */
  async getRun(runId: string, userId: string): Promise<AgentRun | null> {
    const run = await this.storage.getRun(runId);
    
    if (!run) {
      return null;
    }

    // RBAC enforcement: users can only access their own runs
    if (run.metadata.userId !== userId) {
      logger.warn(`User ${userId} attempted to access run ${runId} owned by ${run.metadata.userId}`);
      throw new Error('Access denied: You can only access your own runs');
    }

    return run;
  }

  /**
   * Get node by ID
   */
  async getNode(nodeId: string): Promise<AgentNodeExecution | null> {
    return this.storage.getNode(nodeId);
  }

  /**
   * List recent runs with RBAC enforcement
   */
  async listRuns(limit: number = 100, userId?: string): Promise<AgentRun[]> {
    if (userId) {
      return this.storage.listRunsByUser(userId, limit);
    }
    return this.storage.listRuns(limit);
  }

  /**
   * List runs by agent with RBAC enforcement
   */
  async listRunsByAgent(agentId: string, limit: number = 100, userId?: string): Promise<AgentRun[]> {
    const runs = await this.storage.listRunsByAgent(agentId, limit);
    
    if (userId) {
      // Filter by user for RBAC
      return runs.filter(run => run.metadata.userId === userId);
    }
    
    return runs;
  }

  /**
   * Get supported agent kinds
   */
  getSupportedAgents(): AgentKind[] {
    return AgentHandlerFactory.getSupportedAgents();
  }

  /**
   * Check if agent kind is supported
   */
  isAgentSupported(agentKind: AgentKind): boolean {
    return AgentHandlerFactory.isSupported(agentKind);
  }

  /**
   * Register a custom agent handler
   */
  registerAgentHandler(agentKind: AgentKind, handler: AgentHandler): void {
    AgentHandlerFactory.registerHandler(agentKind, handler);
  }

  /**
   * Get run limits configuration
   */
  getRunLimits(): RunLimits {
    return this.getRunLimits();
  }

  /**
   * Handle a database Run record (for compatibility with existing controller)
   */
  async handle(run: any): Promise<{ status: string; output: string }> {
    try {
      // For ECHO agent, simply return the input as output
      if (run.agent.toLowerCase() === 'echo') {
        return {
          status: 'COMPLETED',
          output: run.input
        };
      }
      
      // For other agents, return error for now
      throw new Error(`Agent ${run.agent} not implemented`);
    } catch (error) {
      return {
        status: 'FAILED',
        output: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

export const jarvis = new JarvisOrchestrator();
