import { logger } from '@bharat-agents/shared';
import { z } from 'zod';

import { SessionManager, Session } from './session';
import { validateNavigationURL } from './utils/urlValidation.js';

// Base action schema
const BaseActionSchema = z.object({
  sessionId: z.string().min(1, 'Session ID is required'),
});

// Goto action
export const GotoActionSchema = BaseActionSchema.extend({
  url: z
    .string()
    .url('Valid URL is required')
    .refine(url => !url.startsWith('file://'), 'File URLs are not allowed'),
});

export interface GotoAction {
  sessionId: string;
  url: string;
}

// Click action
export const ClickActionSchema = BaseActionSchema.extend({
  selector: z.string().min(1, 'Selector is required'),
});

export interface ClickAction {
  sessionId: string;
  selector: string;
}

// Type action
export const TypeActionSchema = BaseActionSchema.extend({
  selector: z.string().min(1, 'Selector is required'),
  text: z.string(),
});

export interface TypeAction {
  sessionId: string;
  selector: string;
  text: string;
}

// Wait for action
export const WaitForActionSchema = BaseActionSchema.extend({
  target: z.union([
    z.string().min(1, 'Selector is required'),
    z.number().positive('Timeout must be positive'),
  ]),
});

export interface WaitForAction {
  sessionId: string;
  target: string | number;
}

// Select action
export const SelectActionSchema = BaseActionSchema.extend({
  selector: z.string().min(1, 'Selector is required'),
  value: z.string().min(1, 'Value is required'),
});

export interface SelectAction {
  sessionId: string;
  selector: string;
  value: string;
}

// Evaluate action
export const EvaluateActionSchema = BaseActionSchema.extend({
  script: z.string().min(1, 'Script is required'),
});

export interface EvaluateAction {
  sessionId: string;
  script: string;
}

// Screenshot action
export const ScreenshotActionSchema = BaseActionSchema.extend({
  fullPage: z.boolean().optional(),
});

export interface ScreenshotAction {
  sessionId: string;
  fullPage?: boolean;
}

// PDF action
export const PdfActionSchema = BaseActionSchema.extend({});

export interface PdfAction {
  sessionId: string;
}

export class BrowserActions {
  constructor(
    private sessionManager: SessionManager,
    private maxNavigationTimeoutMs: number = 30000,
    private allowEvaluate: boolean = false,
    private env: {
      BLOCK_PRIVATE_ADDR: boolean;
      ALLOW_LOCALHOST: boolean;
      ALLOW_DOWNLOADS: boolean;
    }
  ) {}

  /**
   * Navigate to a URL
   */
  async goto(action: GotoAction): Promise<void> {
    const validated = GotoActionSchema.parse(action);
    const session = this.getSession(validated.sessionId);

    // Validate URL for security
    const urlValidation = validateNavigationURL(validated.url, this.env);
    if (!urlValidation.isValid) {
      throw new Error(`URL validation failed: ${urlValidation.error}`);
    }

    try {
      const page = await session.context.newPage();

      // Set up download blocking
      if (!this.env.ALLOW_DOWNLOADS) {
        page.on('download', download => {
          logger.warn('Download blocked', {
            sessionId: validated.sessionId,
            url: download.url(),
            suggestedFilename: download.suggestedFilename(),
          });
          download.cancel();
        });
      }

      // Disable same-origin downloads
      await page.context.addInitScript(() => {
        // Override download behavior
        const originalCreateElement = document.createElement;
        // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
        document.createElement = function (tagName: string) {
          const element = originalCreateElement.call(document, tagName);
          if (tagName.toLowerCase() === 'a') {
            element.addEventListener('click', e => {
              const href = element.getAttribute('href');
              if (
                href &&
                (href.startsWith('blob:') || href.startsWith('data:'))
              ) {
                e.preventDefault();
                console.warn('Download blocked: same-origin download detected');
              }
            });
          }
          return element;
        };
      });

      await page.goto(validated.url, {
        timeout: this.maxNavigationTimeoutMs,
        waitUntil: 'networkidle',
      });
      await page.close();

      logger.info('Navigated to URL', {
        sessionId: validated.sessionId,
        url: validated.url,
      });
    } catch (error) {
      logger.error('Navigation failed', {
        sessionId: validated.sessionId,
        url: validated.url,
        error,
      });
      throw error;
    }
  }

  /**
   * Click an element
   */
  async click(action: ClickAction): Promise<void> {
    const validated = ClickActionSchema.parse(action);
    const session = this.getSession(validated.sessionId);

    try {
      const page = await session.context.newPage();
      await page.click(validated.selector);
      await page.close();

      logger.info('Clicked element', {
        sessionId: validated.sessionId,
        selector: validated.selector,
      });
    } catch (error) {
      logger.error('Click failed', {
        sessionId: validated.sessionId,
        selector: validated.selector,
        error,
      });
      throw error;
    }
  }

  /**
   * Type text into an element
   */
  async type(action: TypeAction): Promise<void> {
    const validated = TypeActionSchema.parse(action);
    const session = this.getSession(validated.sessionId);

    try {
      const page = await session.context.newPage();
      await page.fill(validated.selector, validated.text);
      await page.close();

      logger.info('Typed text', {
        sessionId: validated.sessionId,
        selector: validated.selector,
        textLength: validated.text.length,
      });
    } catch (error) {
      logger.error('Type failed', {
        sessionId: validated.sessionId,
        selector: validated.selector,
        error,
      });
      throw error;
    }
  }

  /**
   * Wait for element or timeout
   */
  async waitFor(action: WaitForAction): Promise<void> {
    const validated = WaitForActionSchema.parse(action);
    const session = this.getSession(validated.sessionId);

    try {
      const page = await session.context.newPage();

      if (typeof validated.target === 'string') {
        await page.waitForSelector(validated.target, {
          timeout: this.maxNavigationTimeoutMs,
        });

        logger.info('Waited for element', {
          sessionId: validated.sessionId,
          selector: validated.target,
        });
      } else {
        await page.waitForTimeout(validated.target);

        logger.info('Waited for timeout', {
          sessionId: validated.sessionId,
          timeout: validated.target,
        });
      }

      await page.close();
    } catch (error) {
      logger.error('Wait failed', {
        sessionId: validated.sessionId,
        target: validated.target,
        error,
      });
      throw error;
    }
  }

  /**
   * Select option from dropdown
   */
  async select(action: SelectAction): Promise<void> {
    const validated = SelectActionSchema.parse(action);
    const session = this.getSession(validated.sessionId);

    try {
      const page = await session.context.newPage();
      await page.selectOption(validated.selector, validated.value);
      await page.close();

      logger.info('Selected option', {
        sessionId: validated.sessionId,
        selector: validated.selector,
        value: validated.value,
      });
    } catch (error) {
      logger.error('Select failed', {
        sessionId: validated.sessionId,
        selector: validated.selector,
        error,
      });
      throw error;
    }
  }

  /**
   * Evaluate JavaScript in the page context
   */
  async evaluate(action: EvaluateAction): Promise<unknown> {
    const validated = EvaluateActionSchema.parse(action);

    if (!this.allowEvaluate) {
      throw new Error('JavaScript evaluation is disabled for security reasons');
    }

    const session = this.getSession(validated.sessionId);

    try {
      // Validate script is safe (only string, no functions/objects)
      if (this.isUnsafeScript(validated.script)) {
        throw new Error(
          'Unsafe script detected. Only string scripts are allowed.'
        );
      }

      const page = await session.context.newPage();
      const result = await page.evaluate(validated.script);
      await page.close();

      logger.info('Evaluated script', {
        sessionId: validated.sessionId,
        scriptLength: validated.script.length,
      });

      return result;
    } catch (error) {
      logger.error('Evaluate failed', {
        sessionId: validated.sessionId,
        error,
      });
      throw error;
    }
  }

  /**
   * Take a screenshot
   */
  async screenshot(action: ScreenshotAction): Promise<Buffer> {
    const validated = ScreenshotActionSchema.parse(action);
    const session = this.getSession(validated.sessionId);

    try {
      const page = await session.context.newPage();
      const screenshot = await page.screenshot({
        fullPage: validated.fullPage || false,
        type: 'png',
      });
      await page.close();

      logger.info('Screenshot taken', {
        sessionId: validated.sessionId,
        fullPage: validated.fullPage,
      });

      return screenshot;
    } catch (error) {
      logger.error('Screenshot failed', {
        sessionId: validated.sessionId,
        error,
      });
      throw error;
    }
  }

  /**
   * Generate PDF (Chromium only)
   */
  async pdf(action: PdfAction): Promise<Buffer> {
    const validated = PdfActionSchema.parse(action);
    const session = this.getSession(validated.sessionId);

    if (session.browserType !== 'chromium') {
      throw new Error('PDF generation is only supported in Chromium');
    }

    try {
      const page = await session.context.newPage();
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
      });
      await page.close();

      logger.info('PDF generated', { sessionId: validated.sessionId });

      return pdf;
    } catch (error) {
      logger.error('PDF generation failed', {
        sessionId: validated.sessionId,
        error,
      });
      throw error;
    }
  }

  /**
   * Get session and validate it exists
   */
  private getSession(sessionId: string): Session {
    const session = this.sessionManager.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    return session;
  }

  /**
   * Check if script is unsafe (contains functions, objects, etc.)
   */
  private isUnsafeScript(script: string): boolean {
    const trimmed = script.trim();

    // Check for function declarations
    if (trimmed.includes('function') || trimmed.includes('=>')) {
      return true;
    }

    // Check for object literals
    if (trimmed.includes('{') && trimmed.includes('}')) {
      return true;
    }

    // Check for array literals
    if (trimmed.includes('[') && trimmed.includes(']')) {
      return true;
    }

    // Check for variable declarations
    if (
      trimmed.includes('let ') ||
      trimmed.includes('const ') ||
      trimmed.includes('var ')
    ) {
      return true;
    }

    // Check for assignment operators
    if (trimmed.includes('=')) {
      return true;
    }

    // Check for control flow
    if (
      trimmed.includes('if') ||
      trimmed.includes('for') ||
      trimmed.includes('while')
    ) {
      return true;
    }

    return false;
  }
}
