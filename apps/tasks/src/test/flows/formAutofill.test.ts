import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  executeFormAutofill, 
  generateFormAutofillSteps,
  formAutofillInputSchema,
  formFieldSchema 
} from '../../flows/formAutofill.js';
import { AgentRunOutput } from '@bharat-agents/shared';

describe('Form Autofill Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Schema Validation', () => {
    it('should validate valid form field', () => {
      const validField = {
        selector: '#email',
        value: 'test@example.com',
      };

      const result = formFieldSchema.safeParse(validField);
      expect(result.success).toBe(true);
    });

    it('should reject invalid form field', () => {
      const invalidFields = [
        { selector: '', value: 'test' }, // Empty selector
        { selector: '#email', value: '' }, // Empty value
        { selector: '#email' }, // Missing value
        { value: 'test' }, // Missing selector
      ];

      invalidFields.forEach(field => {
        const result = formFieldSchema.safeParse(field);
        expect(result.success).toBe(false);
      });
    });

    it('should validate valid form autofill input', () => {
      const validInput = {
        url: 'https://example.com/form',
        fields: [
          { selector: '#name', value: 'John Doe' },
          { selector: '#email', value: 'john@example.com' },
        ],
        submitSelector: '#submit',
      };

      const result = formAutofillInputSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should validate input without submit selector', () => {
      const validInput = {
        url: 'https://example.com/form',
        fields: [
          { selector: '#name', value: 'John Doe' },
        ],
      };

      const result = formAutofillInputSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should reject invalid form autofill input', () => {
      const invalidInputs = [
        { url: 'not-a-url', fields: [] }, // Invalid URL
        { url: 'https://example.com', fields: [] }, // Empty fields
        { fields: [{ selector: '#name', value: 'John' }] }, // Missing URL
        { url: 'https://example.com' }, // Missing fields
      ];

      invalidInputs.forEach(input => {
        const result = formAutofillInputSchema.safeParse(input);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('Step Generation', () => {
    it('should generate steps for form without submit', () => {
      const input = {
        url: 'https://example.com/form',
        fields: [
          { selector: '#name', value: 'John Doe' },
          { selector: '#email', value: 'john@example.com' },
        ],
      };

      const steps = generateFormAutofillSteps(input);

      expect(steps).toHaveLength(6); // navigate + 2 fields (wait + fill each) + screenshot
      
      // Check navigation step
      expect(steps[0]).toMatchObject({
        name: 'navigate_to_form',
        type: 'navigation',
        action: 'goto',
        params: { url: 'https://example.com/form' },
      });

      // Check field steps
      expect(steps[1]).toMatchObject({
        name: 'wait_for_field_0',
        type: 'wait',
        action: 'waitFor',
        params: { selector: '#name' },
      });

      expect(steps[2]).toMatchObject({
        name: 'fill_field_0',
        type: 'interaction',
        action: 'type',
        params: { 
          selector: '#name', 
          text: 'John Doe',
          clear: true 
        },
      });

      expect(steps[3]).toMatchObject({
        name: 'wait_for_field_1',
        type: 'wait',
        action: 'waitFor',
        params: { selector: '#email' },
      });

      expect(steps[4]).toMatchObject({
        name: 'fill_field_1',
        type: 'interaction',
        action: 'type',
        params: { 
          selector: '#email', 
          text: 'john@example.com',
          clear: true 
        },
      });

      // Check screenshot step
      expect(steps[5]).toMatchObject({
        name: 'take_screenshot',
        type: 'artifact',
        action: 'screenshot',
        params: { 
          filename: 'form-autofill-{{timestamp}}',
          fullPage: true 
        },
      });
    });

    it('should generate steps for form with submit', () => {
      const input = {
        url: 'https://example.com/form',
        fields: [
          { selector: '#name', value: 'John Doe' },
        ],
        submitSelector: '#submit',
      };

      const steps = generateFormAutofillSteps(input);

      expect(steps).toHaveLength(8); // navigate + field (wait + fill) + submit (wait + click + navigation) + screenshot
      
      // Check submit steps
      expect(steps[4]).toMatchObject({
        name: 'wait_for_submit_button',
        type: 'wait',
        action: 'waitFor',
        params: { selector: '#submit' },
      });

      expect(steps[5]).toMatchObject({
        name: 'click_submit_button',
        type: 'interaction',
        action: 'click',
        params: { selector: '#submit' },
      });

      expect(steps[6]).toMatchObject({
        name: 'wait_for_navigation',
        type: 'wait',
        action: 'waitForNavigation',
        params: { timeout: 10000 },
      });
    });

    it('should handle single field form', () => {
      const input = {
        url: 'https://example.com/simple-form',
        fields: [
          { selector: '#single-field', value: 'test value' },
        ],
      };

      const steps = generateFormAutofillSteps(input);

      expect(steps).toHaveLength(4); // navigate + field (wait + fill) + screenshot
      expect(steps[1].name).toBe('wait_for_field_0');
      expect(steps[2].name).toBe('fill_field_0');
    });

    it('should handle multiple fields in correct order', () => {
      const input = {
        url: 'https://example.com/multi-form',
        fields: [
          { selector: '#field1', value: 'value1' },
          { selector: '#field2', value: 'value2' },
          { selector: '#field3', value: 'value3' },
        ],
      };

      const steps = generateFormAutofillSteps(input);

      // Should have: navigate + 3 fields (wait + fill each) + screenshot = 8 steps
      expect(steps).toHaveLength(8);
      
      // Check field order
      expect(steps[1].name).toBe('wait_for_field_0');
      expect(steps[2].name).toBe('fill_field_0');
      expect(steps[3].name).toBe('wait_for_field_1');
      expect(steps[4].name).toBe('fill_field_1');
      expect(steps[5].name).toBe('wait_for_field_2');
      expect(steps[6].name).toBe('fill_field_2');
    });
  });

  describe('Flow Execution', () => {
    it('should execute form autofill flow successfully without submit', async () => {
      const input = {
        url: 'https://example.com/form',
        fields: [
          { selector: '#name', value: 'John Doe' },
          { selector: '#email', value: 'john@example.com' },
        ],
      };

      const browserSteps = [];

      const result = await executeFormAutofill(input, browserSteps);

      expect(result).toMatchObject({
        result: {
          finalUrl: 'https://example.com/form',
          success: true,
          fieldsFilled: 2,
          submitted: false,
        },
        metadata: {
          flowType: 'form_autofill',
          stepsExecuted: 5, // navigate + 2 fields (wait + fill each) + screenshot
          fieldsProcessed: 2,
          submitted: false,
          duration: expect.any(Number),
        },
        usage: {
          duration: expect.any(Number),
        },
        artifacts: [
          {
            id: expect.stringMatching(/screenshot-\d+/),
            name: 'form-autofill-screenshot',
            type: 'image/png',
            url: expect.stringMatching(/https:\/\/storage\.example\.com\/screenshots\/form-autofill-\d+\.png/),
            size: 204800,
            createdAt: expect.any(String),
          },
        ],
      });
    });

    it('should execute form autofill flow with submit', async () => {
      const input = {
        url: 'https://example.com/form',
        fields: [
          { selector: '#name', value: 'John Doe' },
        ],
        submitSelector: '#submit',
      };

      const browserSteps = [];

      const result = await executeFormAutofill(input, browserSteps);

      expect(result).toMatchObject({
        result: {
          finalUrl: 'https://example.com/form/submitted',
          success: true,
          fieldsFilled: 1,
          submitted: true,
        },
        metadata: {
          flowType: 'form_autofill',
          stepsExecuted: 7, // navigate + field (wait + fill) + submit (wait + click + navigation) + screenshot
          fieldsProcessed: 1,
          submitted: true,
          duration: expect.any(Number),
        },
        usage: {
          duration: expect.any(Number),
        },
        artifacts: [
          {
            id: expect.stringMatching(/screenshot-\d+/),
            name: 'form-autofill-screenshot',
            type: 'image/png',
            url: expect.stringMatching(/https:\/\/storage\.example\.com\/screenshots\/form-autofill-\d+\.png/),
            size: 204800,
            createdAt: expect.any(String),
          },
        ],
      });
    });

    it('should handle single field form', async () => {
      const input = {
        url: 'https://example.com/simple-form',
        fields: [
          { selector: '#single-field', value: 'test value' },
        ],
      };

      const browserSteps = [];

      const result = await executeFormAutofill(input, browserSteps);

      expect(result.result).toMatchObject({
        finalUrl: 'https://example.com/simple-form',
        success: true,
        fieldsFilled: 1,
        submitted: false,
      });
    });

    it('should include correct metadata', async () => {
      const input = {
        url: 'https://example.com/form',
        fields: [
          { selector: '#name', value: 'John Doe' },
          { selector: '#email', value: 'john@example.com' },
        ],
        submitSelector: '#submit',
      };

      const browserSteps = [];

      const result = await executeFormAutofill(input, browserSteps);

      expect(result.metadata).toMatchObject({
        flowType: 'form_autofill',
        stepsExecuted: 8, // navigate + 2 fields (wait + fill each) + submit (wait + click + navigation) + screenshot
        fieldsProcessed: 2,
        submitted: true,
        duration: expect.any(Number),
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle execution errors gracefully', async () => {
      const input = {
        url: 'https://example.com/form',
        fields: [
          { selector: '#name', value: 'John Doe' },
        ],
      };

      const browserSteps = [];

      // Mock execution to throw an error
      vi.doMock('../../flows/formAutofill.js', async () => {
        const actual = await vi.importActual('../../flows/formAutofill.js');
        return {
          ...actual,
          executeFormAutofill: () => {
            throw new Error('Form execution failed');
          },
        };
      });

      await expect(executeFormAutofill(input, browserSteps)).rejects.toThrow(
        'Form execution failed'
      );
    });
  });
});
