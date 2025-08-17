import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { executePriceMonitor, extractPrice } from '../../flows/priceMonitor.js';
import { AgentRunOutput } from '@bharat-agents/shared';

// Mock environment
vi.mock('../../env.js', () => ({
  env: {
    ALLOW_EVALUATE: false,
  },
}));

describe('Price Monitor Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Price Extraction', () => {
    it('should extract USD price with dollar sign', () => {
      const result = extractPrice('$29.99');
      expect(result).toEqual({ price: 29.99, currency: 'USD' });
    });

    it('should extract USD price with comma separator', () => {
      const result = extractPrice('$1,299.99');
      expect(result).toEqual({ price: 1299.99, currency: 'USD' });
    });

    it('should extract EUR price with euro sign', () => {
      const result = extractPrice('€45.50');
      expect(result).toEqual({ price: 45.50, currency: 'EUR' });
    });

    it('should extract GBP price with pound sign', () => {
      const result = extractPrice('£25.00');
      expect(result).toEqual({ price: 25.00, currency: 'GBP' });
    });

    it('should extract price with currency code after number', () => {
      const result = extractPrice('99.99 USD');
      expect(result).toEqual({ price: 99.99, currency: 'USD' });
    });

    it('should extract price with currency code before number', () => {
      const result = extractPrice('USD 99.99');
      expect(result).toEqual({ price: 99.99, currency: 'USD' });
    });

    it('should extract price with different currency codes', () => {
      const currencies = ['EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF'];
      
      currencies.forEach(currency => {
        const result = extractPrice(`123.45 ${currency}`);
        expect(result).toEqual({ price: 123.45, currency });
      });
    });

    it('should handle price with extra whitespace', () => {
      const result = extractPrice('  $  29.99  ');
      expect(result).toEqual({ price: 29.99, currency: 'USD' });
    });

    it('should handle price with multiple spaces', () => {
      const result = extractPrice('USD    99.99');
      expect(result).toEqual({ price: 99.99, currency: 'USD' });
    });

    it('should return null for invalid price formats', () => {
      const invalidPrices = [
        'Free',
        'Contact us',
        'N/A',
        'Out of stock',
        'Price on request',
        '',
        '   ',
      ];

      invalidPrices.forEach(price => {
        const result = extractPrice(price);
        expect(result).toBeNull();
      });
    });

    it('should return null for zero or negative prices', () => {
      const invalidPrices = ['$0', '$0.00', '-$10', '-10.50'];
      
      invalidPrices.forEach(price => {
        const result = extractPrice(price);
        expect(result).toBeNull();
      });
    });

    it('should handle fallback to just numbers', () => {
      const result = extractPrice('29.99');
      expect(result).toEqual({ price: 29.99, currency: 'USD' });
    });
  });

  describe('Flow Execution', () => {
    it('should execute price monitor flow successfully', async () => {
      const input = {
        productUrl: 'https://example.com/product/123',
        selector: '.price-selector',
      };

      const browserSteps = [
        { name: 'navigate', action: 'goto' },
        { name: 'wait', action: 'waitFor' },
        { name: 'extract', action: 'innerText' },
        { name: 'screenshot', action: 'screenshot' },
      ];

      const result = await executePriceMonitor(input, browserSteps);

      expect(result).toMatchObject({
        result: {
          price: 29.99,
          currency: 'USD',
          url: 'https://example.com/product/123',
          ts: expect.any(String),
        },
        metadata: {
          flowType: 'price_monitor',
          stepsExecuted: 4,
          allowEvaluate: false,
          duration: expect.any(Number),
        },
        usage: {
          duration: expect.any(Number),
        },
        artifacts: [
          {
            id: expect.stringMatching(/screenshot-\d+/),
            name: 'price-monitor-screenshot',
            type: 'image/png',
            url: expect.stringMatching(/https:\/\/storage\.example\.com\/screenshots\/price-monitor-\d+\.png/),
            size: 102400,
            createdAt: expect.any(String),
          },
        ],
      });
    });

    it('should handle price extraction failure', async () => {
      const input = {
        productUrl: 'https://example.com/product/123',
        selector: '.price-selector',
      };

      const browserSteps = [];

      // Mock the price extraction to return null
      vi.doMock('../../flows/priceMonitor.js', async () => {
        const actual = await vi.importActual('../../flows/priceMonitor.js');
        return {
          ...actual,
          extractPrice: () => null,
        };
      });

      await expect(executePriceMonitor(input, browserSteps)).rejects.toThrow(
        'Failed to extract price from text: "$29.99"'
      );
    });

    it('should include correct metadata', async () => {
      const input = {
        productUrl: 'https://example.com/product/123',
        selector: '.price-selector',
      };

      const browserSteps = [];

      const result = await executePriceMonitor(input, browserSteps);

      expect(result.metadata).toMatchObject({
        flowType: 'price_monitor',
        stepsExecuted: 4,
        allowEvaluate: false,
        duration: expect.any(Number),
      });
    });

    it('should generate valid timestamp', async () => {
      const input = {
        productUrl: 'https://example.com/product/123',
        selector: '.price-selector',
      };

      const browserSteps = [];

      const result = await executePriceMonitor(input, browserSteps);

      // Verify timestamp is valid ISO string
      expect(() => new Date(result.result.ts)).not.toThrow();
      expect(result.result.ts).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });
  });

  describe('Browser Steps', () => {
    it('should generate correct browser steps', () => {
      const { priceMonitorSteps } = require('../../flows/priceMonitor.js');

      expect(priceMonitorSteps).toHaveLength(4);
      expect(priceMonitorSteps[0]).toMatchObject({
        name: 'navigate_to_product',
        type: 'navigation',
        action: 'goto',
        params: { url: '{{input.productUrl}}' },
      });

      expect(priceMonitorSteps[1]).toMatchObject({
        name: 'wait_for_price_element',
        type: 'wait',
        action: 'waitFor',
        params: { selector: '{{input.selector}}' },
      });

      expect(priceMonitorSteps[2]).toMatchObject({
        name: 'extract_price_text',
        type: 'extraction',
        action: 'innerText', // Since ALLOW_EVALUATE is false in tests
        params: { selector: '{{input.selector}}' },
      });

      expect(priceMonitorSteps[3]).toMatchObject({
        name: 'take_screenshot',
        type: 'artifact',
        action: 'screenshot',
        params: {
          filename: 'price-monitor-{{timestamp}}',
          fullPage: false,
        },
      });
    });

    it('should use evaluate action when ALLOW_EVALUATE is true', () => {
      // Mock env to return true for ALLOW_EVALUATE
      vi.doMock('../../env.js', () => ({
        env: {
          ALLOW_EVALUATE: true,
        },
      }));

      const { priceMonitorSteps } = require('../../flows/priceMonitor.js');

      expect(priceMonitorSteps[2]).toMatchObject({
        name: 'extract_price_text',
        type: 'extraction',
        action: 'evaluate',
        params: {
          code: expect.stringContaining('document.querySelector'),
        },
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle execution errors gracefully', async () => {
      const input = {
        productUrl: 'https://example.com/product/123',
        selector: '.price-selector',
      };

      const browserSteps = [];

      // Mock execution to throw an error
      vi.doMock('../../flows/priceMonitor.js', async () => {
        const actual = await vi.importActual('../../flows/priceMonitor.js');
        return {
          ...actual,
          executePriceMonitor: () => {
            throw new Error('Browser execution failed');
          },
        };
      });

      await expect(executePriceMonitor(input, browserSteps)).rejects.toThrow(
        'Browser execution failed'
      );
    });
  });
});
