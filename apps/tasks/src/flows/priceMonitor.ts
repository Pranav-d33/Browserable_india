import { z } from 'zod';
import { AgentKind, AgentRunInput, AgentRunOutput } from '@bharat-agents/shared';
import { env } from '../env.js';
import { logger } from '@bharat-agents/shared';

// =============================================================================
// Input/Output Schemas
// =============================================================================

export const priceMonitorInputSchema = z.object({
  productUrl: z.string().url('Product URL must be a valid URL'),
  selector: z.string().min(1, 'Selector is required'),
});

export const priceMonitorOutputSchema = z.object({
  price: z.number().positive('Price must be a positive number'),
  currency: z.string().min(1, 'Currency is required'),
  url: z.string().url('URL must be a valid URL'),
  ts: z.string().datetime('Timestamp must be a valid ISO datetime'),
});

export type PriceMonitorInput = z.infer<typeof priceMonitorInputSchema>;
export type PriceMonitorOutput = z.infer<typeof priceMonitorOutputSchema>;

// =============================================================================
// Price Extraction Utilities
// =============================================================================

/**
 * Extract price from text using various patterns
 */
export function extractPrice(text: string): { price: number; currency: string } | null {
  // Remove extra whitespace and normalize
  const normalizedText = text.trim().replace(/\s+/g, ' ');
  
  // Common price patterns
  const pricePatterns = [
    // $123.45, $123,45, $123
    /\$([0-9,]+\.?[0-9]*)/,
    // €123.45, €123,45, €123
    /€([0-9,]+\.?[0-9]*)/,
    // £123.45, £123,45, £123
    /£([0-9,]+\.?[0-9]*)/,
    // 123.45 USD, 123,45 USD, 123 USD
    /([0-9,]+\.?[0-9]*)\s*(USD|EUR|GBP|CAD|AUD|JPY|CHF|SEK|NOK|DKK|PLN|CZK|HUF|RON|BGN|HRK|RUB|TRY|BRL|MXN|INR|CNY|KRW|SGD|HKD|NZD|ZAR|THB|MYR|IDR|PHP|VND)/i,
    // USD 123.45, EUR 123,45, GBP 123
    /(USD|EUR|GBP|CAD|AUD|JPY|CHF|SEK|NOK|DKK|PLN|CZK|HUF|RON|BGN|HRK|RUB|TRY|BRL|MXN|INR|CNY|KRW|SGD|HKD|NZD|ZAR|THB|MYR|IDR|PHP|VND)\s*([0-9,]+\.?[0-9]*)/i,
    // Just numbers (fallback)
    /([0-9,]+\.?[0-9]*)/,
  ];

  for (const pattern of pricePatterns) {
    const match = normalizedText.match(pattern);
    if (match) {
      let price: number;
      let currency: string;

      if (pattern.source.includes('$')) {
        price = parseFloat(match[1].replace(/,/g, ''));
        currency = 'USD';
      } else if (pattern.source.includes('€')) {
        price = parseFloat(match[1].replace(/,/g, ''));
        currency = 'EUR';
      } else if (pattern.source.includes('£')) {
        price = parseFloat(match[1].replace(/,/g, ''));
        currency = 'GBP';
      } else if (pattern.source.includes('USD|EUR|GBP')) {
        // Check if currency comes before or after the number
        if (match[1] && /^[A-Z]{3}$/i.test(match[1])) {
          // Currency first: "USD 123.45"
          currency = match[1].toUpperCase();
          price = parseFloat(match[2].replace(/,/g, ''));
        } else {
          // Currency second: "123.45 USD"
          price = parseFloat(match[1].replace(/,/g, ''));
          currency = match[2].toUpperCase();
        }
      } else {
        // Fallback: just numbers, assume USD
        price = parseFloat(match[1].replace(/,/g, ''));
        currency = 'USD';
      }

      if (!isNaN(price) && price > 0) {
        return { price, currency };
      }
    }
  }

  return null;
}

// =============================================================================
// Browser Steps
// =============================================================================

/**
 * Browser steps for price monitoring
 */
export const priceMonitorSteps = [
  {
    name: 'navigate_to_product',
    type: 'navigation',
    action: 'goto',
    params: { url: '{{input.productUrl}}' },
  },
  {
    name: 'wait_for_price_element',
    type: 'wait',
    action: 'waitFor',
    params: { selector: '{{input.selector}}' },
  },
  {
    name: 'extract_price_text',
    type: 'extraction',
    action: env.ALLOW_EVALUATE ? 'evaluate' : 'innerText',
    params: env.ALLOW_EVALUATE 
      ? { 
          code: `
            const element = document.querySelector('{{input.selector}}');
            return element ? element.textContent : null;
          `
        }
      : { selector: '{{input.selector}}' },
  },
  {
    name: 'take_screenshot',
    type: 'artifact',
    action: 'screenshot',
    params: { 
      filename: 'price-monitor-{{timestamp}}',
      fullPage: false 
    },
  },
];

// =============================================================================
// Flow Execution
// =============================================================================

/**
 * Execute price monitoring flow
 */
export async function executePriceMonitor(
  input: PriceMonitorInput,
  browserSteps: any[]
): Promise<AgentRunOutput> {
  const startTime = Date.now();
  
  logger.info({
    productUrl: input.productUrl,
    selector: input.selector,
    allowEvaluate: env.ALLOW_EVALUATE,
  }, 'Starting price monitoring flow');

  try {
    // Simulate browser execution steps
    // In a real implementation, these would be executed by the browser agent
    const results = {
      navigate_to_product: { status: 'completed', url: input.productUrl },
      wait_for_price_element: { status: 'completed', selector: input.selector },
      extract_price_text: { status: 'completed', text: '$29.99' }, // Simulated price text
      take_screenshot: { 
        status: 'completed', 
        artifact: {
          id: `screenshot-${Date.now()}`,
          name: 'price-monitor-screenshot',
          type: 'image/png',
          url: `https://storage.example.com/screenshots/price-monitor-${Date.now()}.png`,
          size: 102400,
          createdAt: new Date().toISOString(),
        }
      },
    };

    // Extract price from the simulated text
    const priceText = results.extract_price_text.text;
    const priceData = extractPrice(priceText);

    if (!priceData) {
      throw new Error(`Failed to extract price from text: "${priceText}"`);
    }

    // Create output
    const output: PriceMonitorOutput = {
      price: priceData.price,
      currency: priceData.currency,
      url: input.productUrl,
      ts: new Date().toISOString(),
    };

    const duration = Date.now() - startTime;

    logger.info({
      price: output.price,
      currency: output.currency,
      url: output.url,
      duration,
    }, 'Price monitoring flow completed successfully');

    return {
      result: output,
      metadata: {
        flowType: 'price_monitor',
        stepsExecuted: Object.keys(results).length,
        allowEvaluate: env.ALLOW_EVALUATE,
        duration,
      },
      usage: {
        duration,
      },
      artifacts: [results.take_screenshot.artifact],
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    
    logger.error({
      error: error instanceof Error ? error.message : String(error),
      productUrl: input.productUrl,
      selector: input.selector,
      duration,
    }, 'Price monitoring flow failed');

    throw error;
  }
}

// =============================================================================
// Flow Configuration
// =============================================================================

export const priceMonitorFlow = {
  name: 'price_monitor',
  description: 'Monitor product prices by extracting price information from web pages',
  agentKind: AgentKind.BROWSER,
  inputSchema: priceMonitorInputSchema,
  outputSchema: priceMonitorOutputSchema,
  steps: priceMonitorSteps,
  execute: executePriceMonitor,
};
