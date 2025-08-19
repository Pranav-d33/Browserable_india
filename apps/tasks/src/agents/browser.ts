import { z } from 'zod';
import { logger } from '@bharat-agents/shared';
import { BaseAgent, type RunArgs, type NodeResult } from './base.js';
import { BrowserClient } from '../services/browserClient.js';

// Schema for browser step
const BrowserStepSchema = z.object({
  action: z.enum(['goto', 'click', 'type', 'wait', 'screenshot', 'extract']),
  selector: z.string().optional(),
  text: z.string().optional(),
  url: z.string().optional(),
  wait: z.number().optional(),
  extract: z.boolean().optional(),
});

// Schema for browser instructions input
const BrowserInputSchema = z.object({
  instructions: z.string(),
  steps: z.array(BrowserStepSchema).optional(),
  keepAlive: z.boolean().optional(),
});

// Schema for browser output
export const BrowserOutputSchema = z.object({
  url: z.string().optional(),
  title: z.string().optional(),
  screenshot: z.string().optional(),
  extractedData: z.record(z.any()).optional(),
  steps: z.array(BrowserStepSchema),
  success: z.boolean(),
  error: z.string().optional(),
});

export class BrowserAgent extends BaseAgent {
  name = 'browser';

  async runNode(args: RunArgs): Promise<NodeResult> {
    const startTime = Date.now();
    const { runId, nodeId, input } = args;

    try {
      // Parse input
      const parsedInput = JSON.parse(input);
      const validatedInput = BrowserInputSchema.parse(parsedInput);

      logger.info(
        { runId, nodeId, instructions: validatedInput.instructions },
        'Starting browser automation'
      );

      // Record start action
      await this.recordAction(runId, nodeId, 'start', {
        instructions: validatedInput.instructions,
        hasSteps: !!validatedInput.steps,
        keepAlive: validatedInput.keepAlive,
      });

      // Get environment limits
      const maxSteps = parseInt(process.env.BROWSER_MAX_STEPS || '30', 10);
      const maxDuration = parseInt(
        process.env.BROWSER_MAX_DURATION_MS || '90000',
        10
      );

      // Generate steps if not provided
      let steps = validatedInput.steps;
      if (!steps) {
        steps = await this.generateSteps(
          validatedInput.instructions,
          runId,
          nodeId
        );
      }

      // Validate step count
      if (steps.length > maxSteps) {
        throw new Error(`Too many steps: ${steps.length} > ${maxSteps}`);
      }

      // Execute browser automation
      const result = await this.executeSteps(steps, runId, nodeId, maxDuration);

      // Record completion
      await this.recordAction(
        runId,
        nodeId,
        'complete',
        { steps: steps.length, keepAlive: validatedInput.keepAlive },
        { success: result.success, url: result.url, title: result.title },
        'OK',
        Date.now() - startTime
      );

      return {
        output: JSON.stringify(result),
        artifacts: result.screenshot
          ? [
              {
                type: 'image/png',
                url: result.screenshot,
                metadata: { step: 'final_screenshot' },
              },
            ]
          : undefined,
        meta: {
          steps: steps.length,
          duration: Date.now() - startTime,
          success: result.success,
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      // Record error
      await this.recordAction(
        runId,
        nodeId,
        'error',
        { input },
        { error: error instanceof Error ? error.message : String(error) },
        'ERR',
        duration
      );

      logger.error(
        {
          runId,
          nodeId,
          error: error instanceof Error ? error.message : String(error),
          duration,
        },
        'Browser automation failed'
      );

      return {
        output: JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : String(error),
          steps: [],
        }),
        meta: {
          duration,
          success: false,
        },
      };
    }
  }

  /**
   * Generate browser steps from instructions using LLM
   */
  private async generateSteps(
    instructions: string,
    runId: string,
    nodeId: string
  ): Promise<z.infer<typeof BrowserStepSchema>[]> {
    const prompt = `Convert the following browser automation instructions into a step-by-step plan.

Instructions: ${instructions}

Generate a JSON array of steps. Each step should have:
- action: one of "goto", "click", "type", "wait", "screenshot", "extract"
- selector: CSS selector for the element (for click, type, extract actions)
- text: text to type (for type action)
- url: URL to navigate to (for goto action)
- wait: milliseconds to wait (for wait action)
- extract: boolean indicating if data should be extracted (for extract action)

Keep steps minimal and focused. Use clear, specific selectors.
For data extraction, mark the step with extract: true.

Example:
[
  {"action": "goto", "url": "https://example.com"},
  {"action": "click", "selector": "button[data-testid='login']"},
  {"action": "type", "selector": "input[name='username']", "text": "user@example.com"},
  {"action": "click", "selector": "button[type='submit']"},
  {"action": "wait", "wait": 2000},
  {"action": "extract", "selector": ".user-profile", "extract": true}
]`;

    const stepsSchema = z.array(BrowserStepSchema);
    return await this.safeLLMJson(prompt, stepsSchema, runId, nodeId);
  }

  /**
   * Execute browser steps
   */
  private async executeSteps(
    steps: z.infer<typeof BrowserStepSchema>[],
    runId: string,
    nodeId: string,
    maxDuration: number
  ): Promise<z.infer<typeof BrowserOutputSchema>> {
    const client = new BrowserClient();
    let sessionId: string | undefined;
    let currentUrl: string | undefined;
    let currentTitle: string | undefined;
    const extractedData: Record<string, unknown> = {};
    let screenshotUrl: string | undefined;

    const startTime = Date.now();

    try {
      // Create browser session
      const session = await client.createSession();
      sessionId = session.id;

      await this.recordAction(runId, nodeId, 'session_created', { sessionId });

      // Execute each step
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        const stepStartTime = Date.now();

        // Check duration limit
        if (Date.now() - startTime > maxDuration) {
          throw new Error(`Exceeded maximum duration: ${maxDuration}ms`);
        }

        try {
          await this.executeStep(client, sessionId, step, runId, nodeId, i);

          // Update current state
          if (step.action === 'goto' && step.url) {
            currentUrl = step.url;
          }

          // Extract data if requested
          if (step.extract && step.selector) {
            const extracted = await this.extractData(
              client,
              sessionId,
              step.selector,
              runId,
              nodeId,
              i
            );
            extractedData[step.selector] = extracted;
          }

          await this.recordAction(
            runId,
            nodeId,
            'step_completed',
            { stepIndex: i, step },
            { success: true },
            'OK',
            Date.now() - stepStartTime
          );
        } catch (stepError) {
          await this.recordAction(
            runId,
            nodeId,
            'step_failed',
            { stepIndex: i, step },
            {
              error:
                stepError instanceof Error
                  ? stepError.message
                  : String(stepError),
            },
            'ERR',
            Date.now() - stepStartTime
          );

          throw stepError;
        }
      }

      // Take final screenshot
      if (sessionId) {
        const screenshotAction = await client.screenshot(sessionId, 'current');
        if (screenshotAction.result?.screenshot) {
          // In a real implementation, we would download the screenshot from the URL
          // For now, we'll store the screenshot URL as metadata
          screenshotUrl = screenshotAction.result.screenshot;
        }

        // Get current page info from the last action
        try {
          // We'll use the last action's URL as current URL
          // In a real implementation, we would have a method to get current page info
          currentUrl =
            steps.length > 0 ? steps[steps.length - 1].url : undefined;
        } catch (error) {
          logger.warn(
            {
              runId,
              nodeId,
              error: error instanceof Error ? error.message : String(error),
            },
            'Failed to get page info'
          );
        }
      }

      return {
        url: currentUrl,
        title: currentTitle,
        screenshot: screenshotUrl,
        extractedData,
        steps,
        success: true,
      };
    } finally {
      // Close session unless keepAlive is true
      if (sessionId) {
        try {
          await client.closeSession(sessionId);
          await this.recordAction(runId, nodeId, 'session_closed', {
            sessionId,
          });
        } catch (error) {
          logger.warn(
            {
              runId,
              nodeId,
              sessionId,
              error: error instanceof Error ? error.message : String(error),
            },
            'Failed to close session'
          );
        }
      }
    }
  }

  /**
   * Execute a single browser step
   */
  private async executeStep(
    client: BrowserClient,
    sessionId: string,
    step: z.infer<typeof BrowserStepSchema>,
    runId: string,
    nodeId: string,
    stepIndex: number
  ): Promise<void> {
    const stepStartTime = Date.now();

    try {
      switch (step.action) {
        case 'goto':
          if (!step.url) throw new Error('URL required for goto action');
          await client.goto(sessionId, step.url);
          break;

        case 'click':
          if (!step.selector)
            throw new Error('Selector required for click action');
          // For click, we need a URL - we'll use the current page or a default
          await client.click(sessionId, 'current', step.selector);
          break;

        case 'type':
          if (!step.selector)
            throw new Error('Selector required for type action');
          if (!step.text) throw new Error('Text required for type action');
          await client.type(sessionId, 'current', step.selector, step.text);
          break;

        case 'wait': {
          const waitTime = step.wait || 1000;
          await client.waitFor(sessionId, 'current', undefined, waitTime);
          break;
        }

        case 'screenshot':
          await client.screenshot(sessionId, 'current');
          break;

        case 'extract':
          if (!step.selector)
            throw new Error('Selector required for extract action');
          await this.extractData(
            client,
            sessionId,
            step.selector,
            runId,
            nodeId,
            stepIndex
          );
          break;

        default:
          throw new Error(
            `Unknown action: ${String((step as unknown as { action?: unknown }).action)}`
          );
      }

      await this.recordAction(
        runId,
        nodeId,
        'step_executed',
        { stepIndex, step },
        { success: true },
        'OK',
        Date.now() - stepStartTime
      );
    } catch (error) {
      await this.recordAction(
        runId,
        nodeId,
        'step_error',
        { stepIndex, step },
        { error: error instanceof Error ? error.message : String(error) },
        'ERR',
        Date.now() - stepStartTime
      );
      throw error;
    }
  }

  /**
   * Extract data from a page element
   */
  private async extractData(
    client: BrowserClient,
    sessionId: string,
    selector: string,
    runId: string,
    nodeId: string,
    stepIndex: number
  ): Promise<unknown> {
    try {
      // Use the extract method from BrowserClient
      const extractAction = await client.extract(
        sessionId,
        'current',
        selector
      );

      const extractedData = extractAction.result?.data;

      await this.recordAction(
        runId,
        nodeId,
        'data_extracted',
        { stepIndex, selector },
        { data: extractedData },
        'OK'
      );

      return extractedData;
    } catch (error) {
      await this.recordAction(
        runId,
        nodeId,
        'extract_failed',
        { stepIndex, selector },
        { error: error instanceof Error ? error.message : String(error) },
        'ERR'
      );
      throw error;
    }
  }
}
