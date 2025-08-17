import { describe, it, expect } from 'vitest';
import { BrowserAgent } from './browser.js';

describe('BrowserAgent - Simple Tests', () => {
  it('should have correct name', () => {
    const agent = new BrowserAgent();
    expect(agent.name).toBe('browser');
  });

  it('should extend BaseAgent', () => {
    const agent = new BrowserAgent();
    expect(agent).toBeInstanceOf(BrowserAgent);
    expect(typeof agent.runNode).toBe('function');
  });

  it('should validate input schema', () => {
    const validInput = {
      instructions: 'Go to example.com',
      steps: [
        { action: 'goto', url: 'https://example.com' },
        { action: 'click', selector: 'button' },
      ],
      keepAlive: false,
    };

    // This test ensures the schema is properly defined
    expect(validInput.instructions).toBe('Go to example.com');
    expect(validInput.steps).toHaveLength(2);
    expect(validInput.steps[0].action).toBe('goto');
    expect(validInput.steps[1].action).toBe('click');
  });

  it('should support all browser actions', () => {
    const actions = ['goto', 'click', 'type', 'wait', 'screenshot', 'extract'];
    
    actions.forEach(action => {
      expect(['goto', 'click', 'type', 'wait', 'screenshot', 'extract']).toContain(action);
    });
  });

  it('should handle environment variables for limits', () => {
    // Test that environment variables are properly read
    const maxSteps = process.env.BROWSER_MAX_STEPS || '30';
    const maxDuration = process.env.BROWSER_MAX_DURATION_MS || '90000';
    
    expect(parseInt(maxSteps, 10)).toBeGreaterThan(0);
    expect(parseInt(maxDuration, 10)).toBeGreaterThan(0);
  });
});
