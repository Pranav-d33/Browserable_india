import { z } from 'zod';
import { AgentKind, AgentRunInput, AgentRunOutput } from '@bharat-agents/shared';
import { logger } from '@bharat-agents/shared';

// =============================================================================
// Input/Output Schemas
// =============================================================================

export const formFieldSchema = z.object({
  selector: z.string().min(1, 'Field selector is required'),
  value: z.string().min(1, 'Field value is required'),
});

export const formAutofillInputSchema = z.object({
  url: z.string().url('URL must be a valid URL'),
  fields: z.array(formFieldSchema).min(1, 'At least one field is required'),
  submitSelector: z.string().optional(),
});

export const formAutofillOutputSchema = z.object({
  finalUrl: z.string().url('Final URL must be a valid URL'),
  success: z.boolean(),
  fieldsFilled: z.number().min(0),
  submitted: z.boolean(),
});

export type FormAutofillInput = z.infer<typeof formAutofillInputSchema>;
export type FormAutofillOutput = z.infer<typeof formAutofillOutputSchema>;
export type FormField = z.infer<typeof formFieldSchema>;

// =============================================================================
// Browser Steps
// =============================================================================

/**
 * Generate browser steps for form autofill
 */
export function generateFormAutofillSteps(input: FormAutofillInput): any[] {
  const steps = [
    {
      name: 'navigate_to_form',
      type: 'navigation',
      action: 'goto',
      params: { url: input.url },
    },
  ];

  // Add steps for each field
  input.fields.forEach((field, index) => {
    steps.push(
      {
        name: `wait_for_field_${index}`,
        type: 'wait',
        action: 'waitFor',
        params: { selector: field.selector },
      },
      {
        name: `fill_field_${index}`,
        type: 'interaction',
        action: 'type',
        params: { 
          selector: field.selector, 
          text: field.value,
          clear: true 
        },
      }
    );
  });

  // Add optional submit step
  if (input.submitSelector) {
    steps.push(
      {
        name: 'wait_for_submit_button',
        type: 'wait',
        action: 'waitFor',
        params: { selector: input.submitSelector },
      },
      {
        name: 'click_submit_button',
        type: 'interaction',
        action: 'click',
        params: { selector: input.submitSelector },
      },
      {
        name: 'wait_for_navigation',
        type: 'wait',
        action: 'waitForNavigation',
        params: { timeout: 10000 },
      }
    );
  }

  // Add screenshot step
  steps.push({
    name: 'take_screenshot',
    type: 'artifact',
    action: 'screenshot',
    params: { 
      filename: 'form-autofill-{{timestamp}}',
      fullPage: true 
    },
  });

  return steps;
}

// =============================================================================
// Flow Execution
// =============================================================================

/**
 * Execute form autofill flow
 */
export async function executeFormAutofill(
  input: FormAutofillInput,
  browserSteps: any[]
): Promise<AgentRunOutput> {
  const startTime = Date.now();
  
  logger.info({
    url: input.url,
    fieldsCount: input.fields.length,
    hasSubmitSelector: !!input.submitSelector,
  }, 'Starting form autofill flow');

  try {
    // Simulate browser execution steps
    // In a real implementation, these would be executed by the browser agent
    const results: Record<string, any> = {
      navigate_to_form: { status: 'completed', url: input.url },
    };

    // Simulate field filling
    let fieldsFilled = 0;
    input.fields.forEach((field, index) => {
      results[`wait_for_field_${index}`] = { 
        status: 'completed', 
        selector: field.selector 
      };
      results[`fill_field_${index}`] = { 
        status: 'completed', 
        selector: field.selector,
        value: field.value 
      };
      fieldsFilled++;
    });

    let submitted = false;
    let finalUrl = input.url;

    // Simulate submit if selector provided
    if (input.submitSelector) {
      results.wait_for_submit_button = { 
        status: 'completed', 
        selector: input.submitSelector 
      };
      results.click_submit_button = { 
        status: 'completed', 
        selector: input.submitSelector 
      };
      results.wait_for_navigation = { 
        status: 'completed', 
        newUrl: `${input.url}/submitted` 
      };
      finalUrl = `${input.url}/submitted`;
      submitted = true;
    }

    // Simulate screenshot
    results.take_screenshot = { 
      status: 'completed', 
      artifact: {
        id: `screenshot-${Date.now()}`,
        name: 'form-autofill-screenshot',
        type: 'image/png',
        url: `https://storage.example.com/screenshots/form-autofill-${Date.now()}.png`,
        size: 204800,
        createdAt: new Date().toISOString(),
      }
    };

    // Create output
    const output: FormAutofillOutput = {
      finalUrl,
      success: true,
      fieldsFilled,
      submitted,
    };

    const duration = Date.now() - startTime;

    logger.info({
      finalUrl: output.finalUrl,
      fieldsFilled: output.fieldsFilled,
      submitted: output.submitted,
      duration,
    }, 'Form autofill flow completed successfully');

    return {
      result: output,
      metadata: {
        flowType: 'form_autofill',
        stepsExecuted: Object.keys(results).length,
        fieldsProcessed: input.fields.length,
        submitted,
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
      url: input.url,
      fieldsCount: input.fields.length,
      duration,
    }, 'Form autofill flow failed');

    throw error;
  }
}

// =============================================================================
// Flow Configuration
// =============================================================================

export const formAutofillFlow = {
  name: 'form_autofill',
  description: 'Automatically fill and optionally submit web forms',
  agentKind: AgentKind.BROWSER,
  inputSchema: formAutofillInputSchema,
  outputSchema: formAutofillOutputSchema,
  generateSteps: generateFormAutofillSteps,
  execute: executeFormAutofill,
};
