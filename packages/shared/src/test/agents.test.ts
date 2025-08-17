import { describe, it, expect } from 'vitest';
import {
  AgentKind,
  AgentRunStatus,
  AgentNodeStatus,
  AgentCapability,
  type Agent,
  type AgentRun,
  type AgentNodeExecution,
  type EchoAgentPayload,
  type BrowserAgentPayload,
  type GenAgentPayload,
  type ResearchAgentPayload,
  isAgentKind,
  isAgentRunStatus,
  isAgentNodeStatus,
  isAgentCapability,
  isAgent,
  isAgentRun,
  isAgentNodeExecution,
  isEchoAgentPayload,
  isBrowserAgentPayload,
  isGenAgentPayload,
  isResearchAgentPayload,
  safeStringify,
  safeParse,
  deepCloneAgent,
  validateAgentConfig,
  createDefaultAgentConfig,
  calculateAgentRunDuration,
  isAgentRunTerminal,
  isAgentNodeTerminal,
  getAgentCapabilities,
  generateAgentRunId,
  generateAgentNodeId,
  createAgentRun,
  createAgentNodeExecution,
} from '../agents.js';

describe('Agents Module', () => {
  describe('Enums', () => {
    it('should have correct AgentKind values', () => {
      expect(AgentKind.ECHO).toBe('ECHO');
      expect(AgentKind.BROWSER).toBe('BROWSER');
      expect(AgentKind.GEN).toBe('GEN');
      expect(AgentKind.RESEARCH).toBe('RESEARCH');
    });

    it('should have correct AgentRunStatus values', () => {
      expect(AgentRunStatus.PENDING).toBe('pending');
      expect(AgentRunStatus.RUNNING).toBe('running');
      expect(AgentRunStatus.COMPLETED).toBe('completed');
      expect(AgentRunStatus.FAILED).toBe('failed');
      expect(AgentRunStatus.CANCELLED).toBe('cancelled');
      expect(AgentRunStatus.TIMEOUT).toBe('timeout');
      expect(AgentRunStatus.PAUSED).toBe('paused');
    });

    it('should have correct AgentNodeStatus values', () => {
      expect(AgentNodeStatus.PENDING).toBe('pending');
      expect(AgentNodeStatus.RUNNING).toBe('running');
      expect(AgentNodeStatus.COMPLETED).toBe('completed');
      expect(AgentNodeStatus.FAILED).toBe('failed');
      expect(AgentNodeStatus.CANCELLED).toBe('cancelled');
      expect(AgentNodeStatus.SKIPPED).toBe('skipped');
      expect(AgentNodeStatus.WAITING).toBe('waiting');
    });
  });

  describe('Type Guards', () => {
    it('should validate AgentKind', () => {
      expect(isAgentKind('ECHO')).toBe(true);
      expect(isAgentKind('BROWSER')).toBe(true);
      expect(isAgentKind('INVALID')).toBe(false);
      expect(isAgentKind(123)).toBe(false);
      expect(isAgentKind(null)).toBe(false);
    });

    it('should validate AgentRunStatus', () => {
      expect(isAgentRunStatus('pending')).toBe(true);
      expect(isAgentRunStatus('completed')).toBe(true);
      expect(isAgentRunStatus('invalid')).toBe(false);
      expect(isAgentRunStatus(123)).toBe(false);
    });

    it('should validate AgentNodeStatus', () => {
      expect(isAgentNodeStatus('pending')).toBe(true);
      expect(isAgentNodeStatus('completed')).toBe(true);
      expect(isAgentNodeStatus('invalid')).toBe(false);
    });

    it('should validate AgentCapability', () => {
      expect(isAgentCapability('text_generation')).toBe(true);
      expect(isAgentCapability('browser_automation')).toBe(true);
      expect(isAgentCapability('invalid')).toBe(false);
    });

    it('should validate Agent', () => {
      const validAgent: Agent = {
        id: 'agent-1',
        kind: AgentKind.ECHO,
        name: 'Test Agent',
        version: '1.0.0',
        capabilities: [AgentCapability.TEXT_GENERATION],
        config: { timeout: 5000 },
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true,
      };

      expect(isAgent(validAgent)).toBe(true);
      expect(isAgent({})).toBe(false);
      expect(isAgent(null)).toBe(false);
    });

    it('should validate AgentRun', () => {
      const validRun: AgentRun = {
        id: 'run-1',
        agentId: 'agent-1',
        status: AgentRunStatus.PENDING,
        input: { prompt: 'test' },
        metadata: {},
        startedAt: new Date(),
        nodes: [],
      };

      expect(isAgentRun(validRun)).toBe(true);
      expect(isAgentRun({})).toBe(false);
    });

    it('should validate AgentNodeExecution', () => {
      const validNode: AgentNodeExecution = {
        id: 'node-1',
        name: 'Test Node',
        type: 'test',
        status: AgentNodeStatus.PENDING,
        input: {},
        startedAt: new Date(),
        attempts: 0,
        maxAttempts: 3,
      };

      expect(isAgentNodeExecution(validNode)).toBe(true);
      expect(isAgentNodeExecution({})).toBe(false);
    });

    it('should validate payload types', () => {
      const echoPayload: EchoAgentPayload = { message: 'test' };
      const browserPayload: BrowserAgentPayload = {
        sessionId: 'session-1',
        actions: [],
      };
      const genPayload: GenAgentPayload = { prompt: 'test prompt' };
      const researchPayload: ResearchAgentPayload = { query: 'test query' };

      expect(isEchoAgentPayload(echoPayload)).toBe(true);
      expect(isBrowserAgentPayload(browserPayload)).toBe(true);
      expect(isGenAgentPayload(genPayload)).toBe(true);
      expect(isResearchAgentPayload(researchPayload)).toBe(true);

      expect(isEchoAgentPayload({})).toBe(false);
      expect(isBrowserAgentPayload({})).toBe(false);
      expect(isGenAgentPayload({})).toBe(false);
      expect(isResearchAgentPayload({})).toBe(false);
    });
  });

  describe('Serializers & Utilities', () => {
    it('should safely stringify BigInt values', () => {
      const data = { bigNumber: BigInt(123456789) };
      const result = safeStringify(data);
      expect(result).toContain('"123456789n"');
    });

    it('should safely stringify Date objects', () => {
      const date = new Date('2024-01-01T00:00:00.000Z');
      const data = { date };
      const result = safeStringify(data);
      expect(result).toContain('"2024-01-01T00:00:00.000Z"');
    });

    it('should safely stringify Error objects', () => {
      const error = new Error('Test error');
      const data = { error };
      const result = safeStringify(data);
      expect(result).toContain('"name":"Error"');
      expect(result).toContain('"message":"Test error"');
    });

    it('should safely parse BigInt values', () => {
      const json = '{"bigNumber":"123456789n"}';
      const result = safeParse(json) as { bigNumber: bigint };
      expect(typeof result.bigNumber).toBe('bigint');
      expect(result.bigNumber).toBe(BigInt(123456789));
    });

    it('should deep clone objects', () => {
      const original = {
        string: 'test',
        number: 123,
        array: [1, 2, 3],
        object: { nested: 'value' },
        date: new Date(),
      };

      const cloned = deepCloneAgent(original);
      expect(cloned).toEqual(original);
      expect(cloned).not.toBe(original);
      expect(cloned.array).not.toBe(original.array);
      expect(cloned.object).not.toBe(original.object);
    });

    it('should validate agent configuration', () => {
      const validConfig = {
        timeout: 5000,
        maxRetries: 3,
        rateLimit: { requests: 10, windowMs: 60000 },
      };

      expect(validateAgentConfig(validConfig)).toBe(true);
      expect(validateAgentConfig({ timeout: -1 })).toBe(false);
      expect(validateAgentConfig({ maxRetries: -1 })).toBe(false);
      expect(
        validateAgentConfig({ rateLimit: { requests: 0, windowMs: 60000 } })
      ).toBe(false);
    });

    it('should create default agent configurations', () => {
      const echoConfig = createDefaultAgentConfig(AgentKind.ECHO);
      const browserConfig = createDefaultAgentConfig(AgentKind.BROWSER);
      const genConfig = createDefaultAgentConfig(AgentKind.GEN);
      const researchConfig = createDefaultAgentConfig(AgentKind.RESEARCH);

      expect(echoConfig.timeout).toBe(5000);
      expect(browserConfig.timeout).toBe(60000);
      expect(browserConfig.maxRetries).toBe(1);
      expect(genConfig.timeout).toBe(120000);
      expect(researchConfig.timeout).toBe(90000);
    });

    it('should calculate run duration', () => {
      const startTime = new Date('2024-01-01T00:00:00.000Z');
      const endTime = new Date('2024-01-01T00:00:05.000Z'); // 5 seconds later

      const run: AgentRun = {
        id: 'run-1',
        agentId: 'agent-1',
        status: AgentRunStatus.COMPLETED,
        input: { prompt: 'test' },
        metadata: {},
        startedAt: startTime,
        completedAt: endTime,
        nodes: [],
      };

      const duration = calculateAgentRunDuration(run);
      expect(duration).toBe(5000); // 5 seconds in milliseconds
    });

    it('should check terminal states', () => {
      expect(isAgentRunTerminal(AgentRunStatus.COMPLETED)).toBe(true);
      expect(isAgentRunTerminal(AgentRunStatus.FAILED)).toBe(true);
      expect(isAgentRunTerminal(AgentRunStatus.PENDING)).toBe(false);
      expect(isAgentRunTerminal(AgentRunStatus.RUNNING)).toBe(false);

      expect(isAgentNodeTerminal(AgentNodeStatus.COMPLETED)).toBe(true);
      expect(isAgentNodeTerminal(AgentNodeStatus.FAILED)).toBe(true);
      expect(isAgentNodeTerminal(AgentNodeStatus.PENDING)).toBe(false);
      expect(isAgentNodeTerminal(AgentNodeStatus.RUNNING)).toBe(false);
    });

    it('should get agent capabilities', () => {
      const echoCapabilities = getAgentCapabilities(AgentKind.ECHO);
      const browserCapabilities = getAgentCapabilities(AgentKind.BROWSER);
      const genCapabilities = getAgentCapabilities(AgentKind.GEN);
      const researchCapabilities = getAgentCapabilities(AgentKind.RESEARCH);

      expect(echoCapabilities).toContain(AgentCapability.TEXT_GENERATION);
      expect(browserCapabilities).toContain(AgentCapability.BROWSER_AUTOMATION);
      expect(genCapabilities).toContain(AgentCapability.TEXT_GENERATION);
      expect(genCapabilities).toContain(AgentCapability.IMAGE_GENERATION);
      expect(researchCapabilities).toContain(AgentCapability.WEB_RESEARCH);
    });

    it('should generate unique IDs', () => {
      const runId1 = generateAgentRunId();
      const runId2 = generateAgentRunId();
      const nodeId1 = generateAgentNodeId();
      const nodeId2 = generateAgentNodeId();

      expect(runId1).toMatch(/^agent_run_\d+_[a-z0-9]+$/);
      expect(runId2).toMatch(/^agent_run_\d+_[a-z0-9]+$/);
      expect(runId1).not.toBe(runId2);

      expect(nodeId1).toMatch(/^agent_node_\d+_[a-z0-9]+$/);
      expect(nodeId2).toMatch(/^agent_node_\d+_[a-z0-9]+$/);
      expect(nodeId1).not.toBe(nodeId2);
    });

    it('should create run instances', () => {
      const input = { prompt: 'test prompt' };
      const metadata = { userId: 'user-1' };
      const run = createAgentRun('agent-1', input, metadata);

      expect(run.id).toMatch(/^agent_run_\d+_[a-z0-9]+$/);
      expect(run.agentId).toBe('agent-1');
      expect(run.status).toBe(AgentRunStatus.PENDING);
      expect(run.input).toEqual(input);
      expect(run.metadata).toEqual(metadata);
      expect(run.nodes).toEqual([]);
      expect(run.startedAt).toBeInstanceOf(Date);
    });

    it('should create node execution instances', () => {
      const input = { url: 'https://example.com' };
      const node = createAgentNodeExecution('Navigate', 'navigate', input, 3);

      expect(node.id).toMatch(/^agent_node_\d+_[a-z0-9]+$/);
      expect(node.name).toBe('Navigate');
      expect(node.type).toBe('navigate');
      expect(node.status).toBe(AgentNodeStatus.PENDING);
      expect(node.input).toEqual(input);
      expect(node.attempts).toBe(0);
      expect(node.maxAttempts).toBe(3);
      expect(node.startedAt).toBeInstanceOf(Date);
    });
  });
});
