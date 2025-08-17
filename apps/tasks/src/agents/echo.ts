import { logger } from '@bharat-agents/shared';
import { BaseAgent, RunContext, RunResult, NodeResult, NodeStatus, RunStatus } from './base.js';
import { db } from '../db/client.js';

export class EchoAgent implements BaseAgent {
  name = 'echo';
  description = 'Simple echo agent that returns the input';

  async runNode(params: {
    runId: string;
    nodeId: string;
    input: string;
    ctx: RunContext;
  }): Promise<NodeResult> {
    const { runId, nodeId, input, ctx } = params;

    logger.info({
      agent: this.name,
      runId,
      nodeId,
      inputLength: input.length,
    }, 'Echo agent running node');

    try {
      // Update node status to running
      await db.node.update({
        where: { id: nodeId },
        data: {
          status: NodeStatus.RUNNING,
          startedAt: new Date(),
        },
      });

      // Simulate processing delay
      await new Promise(resolve => setTimeout(resolve, 100));

      // Echo the input
      const output = `Echo: ${input}`;

      // Update node with result
      await db.node.update({
        where: { id: nodeId },
        data: {
          status: NodeStatus.COMPLETED,
          output,
          finishedAt: new Date(),
        },
      });

      logger.info({
        agent: this.name,
        runId,
        nodeId,
        status: NodeStatus.COMPLETED,
      }, 'Echo agent node completed');

      return {
        status: NodeStatus.COMPLETED,
        output,
        metadata: {
          agent: this.name,
          processedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      logger.error({
        agent: this.name,
        runId,
        nodeId,
        error,
      }, 'Echo agent node failed');

      // Update node with error
      await db.node.update({
        where: { id: nodeId },
        data: {
          status: NodeStatus.FAILED,
          output: error instanceof Error ? error.message : 'Unknown error',
          finishedAt: new Date(),
        },
      });

      return {
        status: NodeStatus.FAILED,
        output: '',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async run(params: {
    runId: string;
    input: string;
    ctx: RunContext;
  }): Promise<RunResult> {
    const { runId, input, ctx } = params;

    logger.info({
      agent: this.name,
      runId,
      inputLength: input.length,
    }, 'Echo agent running task');

    try {
      // Create a node for this run
      const node = await db.node.create({
        data: {
          runId,
          kind: 'echo',
          status: NodeStatus.PENDING,
          input,
        },
      });

      // Run the node
      const nodeResult = await this.runNode({
        runId,
        nodeId: node.id,
        input,
        ctx,
      });

      // Determine run status based on node result
      const runStatus = nodeResult.status === NodeStatus.COMPLETED 
        ? RunStatus.COMPLETED 
        : RunStatus.FAILED;

      logger.info({
        agent: this.name,
        runId,
        status: runStatus,
      }, 'Echo agent task completed');

      return {
        status: runStatus,
        output: nodeResult.output,
        error: nodeResult.error,
        metadata: {
          agent: this.name,
          nodeId: node.id,
          processedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      logger.error({
        agent: this.name,
        runId,
        error,
      }, 'Echo agent task failed');

      return {
        status: RunStatus.FAILED,
        output: '',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
