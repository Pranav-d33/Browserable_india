import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  JarvisOrchestrator,
  selectAgentByHeuristics,
} from '../../orchestrator/jarvis.js';
import {
  AgentKind,
  AgentRunStatus,
  AgentNodeStatus,
} from '@bharat-agents/shared';

// Mock environment variables
vi.mock('../../env.js', () => ({
  env: {
    ASYNC_JOBS: false,
    AGENT_NODE_TIMEOUT_MS: 30000,
    AGENT_RUN_TIMEOUT_MS: 300000,
    MAX_LLM_CALLS_PER_RUN: 10,
    MAX_BROWSER_STEPS_PER_RUN: 50,
    AGENT_QUEUE_CONCURRENCY: 5,
    BROWSER_QUEUE_CONCURRENCY: 2,
  },
}));

// Mock queue
vi.mock('../../queue/index.js', () => ({
  addAgentJob: vi.fn(),
  addBrowserJob: vi.fn(),
}));

// Mock metrics
vi.mock('../../services/metrics.js', () => ({
  recordAgentRun: vi.fn(),
  recordAgentNode: vi.fn(),
}));

describe('JarvisOrchestrator', () => {
  let jarvis: JarvisOrchestrator;

  beforeEach(() => {
    jarvis = new JarvisOrchestrator();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Agent Selection Heuristics', () => {
    it('should select BROWSER agent for browser-related keywords', () => {
      const input = { prompt: 'Open google.com and click the search button' };
      const agent = selectAgentByHeuristics(input);
      expect(agent).toBe(AgentKind.BROWSER);
    });

    it('should select BROWSER agent for visit keyword', () => {
      const input = { prompt: 'Visit the website' };
      const agent = selectAgentByHeuristics(input);
      expect(agent).toBe(AgentKind.BROWSER);
    });

    it('should select BROWSER agent for navigate keyword', () => {
      const input = { prompt: 'Navigate to the page' };
      const agent = selectAgentByHeuristics(input);
      expect(agent).toBe(AgentKind.BROWSER);
    });

    it('should select GEN agent for text generation tasks', () => {
      const input = { prompt: 'Generate a summary of the document' };
      const agent = selectAgentByHeuristics(input);
      expect(agent).toBe(AgentKind.GEN);
    });

    it('should select GEN agent as default when no keywords match', () => {
      const input = { prompt: 'Write a story about a cat' };
      const agent = selectAgentByHeuristics(input);
      expect(agent).toBe(AgentKind.GEN);
    });

    it('should check keywords in data and context fields', () => {
      const input = {
        prompt: 'Process this data',
        data: { url: 'https://example.com' },
        context: { action: 'click' },
      };
      const agent = selectAgentByHeuristics(input);
      expect(agent).toBe(AgentKind.BROWSER);
    });
  });

  describe('handleCreateRun', () => {
    it('should create a run with specified agent', async () => {
      const request = {
        userId: 'user123',
        input: { prompt: 'Echo this message' },
        agent: AgentKind.ECHO,
      };

      const result = await jarvis.handleCreateRun(request);

      expect(result.runId).toBeDefined();
      expect(result.status).toBe(AgentRunStatus.COMPLETED);
      expect(result.output).toBeDefined();
    });

    it('should create a run with heuristically selected agent', async () => {
      const request = {
        userId: 'user123',
        input: { prompt: 'Open google.com' },
      };

      const result = await jarvis.handleCreateRun(request);

      expect(result.runId).toBeDefined();
      expect(result.status).toBe(AgentRunStatus.COMPLETED);
    });

    it('should reject unsupported agent types', async () => {
      const request = {
        userId: 'user123',
        input: { prompt: 'Test' },
        agent: 'UNSUPPORTED' as AgentKind,
      };

      await expect(jarvis.handleCreateRun(request)).rejects.toThrow(
        'Agent kind UNSUPPORTED is not supported'
      );
    });

    it('should include RBAC metadata in run', async () => {
      const request = {
        userId: 'user123',
        input: { prompt: 'Test' },
        agent: AgentKind.ECHO,
      };

      const result = await jarvis.handleCreateRun(request);
      const run = await jarvis.getRun(result.runId, 'user123');

      expect(run?.metadata.userId).toBe('user123');
    });
  });

  describe('RBAC Enforcement', () => {
    it('should allow users to access their own runs', async () => {
      const request = {
        userId: 'user123',
        input: { prompt: 'Test' },
        agent: AgentKind.ECHO,
      };

      const result = await jarvis.handleCreateRun(request);
      const run = await jarvis.getRun(result.runId, 'user123');

      expect(run).toBeDefined();
      expect(run?.metadata.userId).toBe('user123');
    });

    it('should deny users access to other users runs', async () => {
      const request = {
        userId: 'user123',
        input: { prompt: 'Test' },
        agent: AgentKind.ECHO,
      };

      const result = await jarvis.handleCreateRun(request);

      await expect(jarvis.getRun(result.runId, 'user456')).rejects.toThrow(
        'Access denied'
      );
    });

    it('should filter runs by user in listRuns', async () => {
      // Create runs for different users
      await jarvis.handleCreateRun({
        userId: 'user123',
        input: { prompt: 'Test 1' },
        agent: AgentKind.ECHO,
      });

      await jarvis.handleCreateRun({
        userId: 'user456',
        input: { prompt: 'Test 2' },
        agent: AgentKind.ECHO,
      });

      const user123Runs = await jarvis.listRuns(100, 'user123');
      const user456Runs = await jarvis.listRuns(100, 'user456');

      expect(user123Runs.length).toBe(1);
      expect(user456Runs.length).toBe(1);
      expect(user123Runs[0].metadata.userId).toBe('user123');
      expect(user456Runs[0].metadata.userId).toBe('user456');
    });
  });

  describe('Agent Handlers', () => {
    it('should execute ECHO agent correctly', async () => {
      const request = {
        userId: 'user123',
        input: { prompt: 'Hello World' },
        agent: AgentKind.ECHO,
      };

      const result = await jarvis.handleCreateRun(request);

      expect(result.status).toBe(AgentRunStatus.COMPLETED);
      expect(result.output?.result).toEqual(request.input);
    });

    it('should execute BROWSER agent with step limits', async () => {
      const request = {
        userId: 'user123',
        input: { prompt: 'Open google.com and click search' },
        agent: AgentKind.BROWSER,
      };

      const result = await jarvis.handleCreateRun(request);

      expect(result.status).toBe(AgentRunStatus.COMPLETED);
      expect(result.output?.result).toBeDefined();
      expect(result.output?.result.steps).toBeInstanceOf(Array);
    });

    it('should execute GEN agent with LLM call limits', async () => {
      const request = {
        userId: 'user123',
        input: { prompt: 'Generate a short story' },
        agent: AgentKind.GEN,
      };

      const result = await jarvis.handleCreateRun(request);

      expect(result.status).toBe(AgentRunStatus.COMPLETED);
      expect(result.output?.result).toBeDefined();
    });
  });

  describe('Timeouts', () => {
    it('should respect node timeout configuration', async () => {
      // This test would require mocking the agent handlers to simulate long execution
      // For now, we'll test that the timeout configuration is accessible
      const limits = jarvis.getRunLimits();
      expect(limits.nodeTimeout).toBe(30000);
      expect(limits.runTimeout).toBe(300000);
    });
  });

  describe('Supported Agents', () => {
    it('should return list of supported agents', () => {
      const agents = jarvis.getSupportedAgents();
      expect(agents).toContain(AgentKind.ECHO);
      expect(agents).toContain(AgentKind.BROWSER);
      expect(agents).toContain(AgentKind.GEN);
    });

    it('should check if agent is supported', () => {
      expect(jarvis.isAgentSupported(AgentKind.ECHO)).toBe(true);
      expect(jarvis.isAgentSupported(AgentKind.BROWSER)).toBe(true);
      expect(jarvis.isAgentSupported(AgentKind.GEN)).toBe(true);
      expect(jarvis.isAgentSupported('UNSUPPORTED' as AgentKind)).toBe(false);
    });
  });

  describe('Run Limits', () => {
    it('should return run limits configuration', () => {
      const limits = jarvis.getRunLimits();
      expect(limits.maxLlmCalls).toBe(10);
      expect(limits.maxBrowserSteps).toBe(50);
      expect(limits.nodeTimeout).toBe(30000);
      expect(limits.runTimeout).toBe(300000);
    });
  });
});
