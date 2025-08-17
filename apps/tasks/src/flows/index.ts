// =============================================================================
// Flow Exports
// =============================================================================

// Price Monitor Flow
export {
  priceMonitorFlow,
  priceMonitorSteps,
  executePriceMonitor,
  priceMonitorInputSchema,
  priceMonitorOutputSchema,
  type PriceMonitorInput,
  type PriceMonitorOutput,
} from './priceMonitor.js';

// Form Autofill Flow
export {
  formAutofillFlow,
  generateFormAutofillSteps,
  executeFormAutofill,
  formAutofillInputSchema,
  formAutofillOutputSchema,
  formFieldSchema,
  type FormAutofillInput,
  type FormAutofillOutput,
  type FormField,
} from './formAutofill.js';

// =============================================================================
// Flow Registry
// =============================================================================

export const availableFlows = {
  price_monitor: {
    name: 'price_monitor',
    description: 'Monitor product prices by extracting price information from web pages',
    agentKind: 'BROWSER' as const,
    inputSchema: 'priceMonitorInputSchema',
    outputSchema: 'priceMonitorOutputSchema',
  },
  form_autofill: {
    name: 'form_autofill',
    description: 'Automatically fill and optionally submit web forms',
    agentKind: 'BROWSER' as const,
    inputSchema: 'formAutofillInputSchema',
    outputSchema: 'formAutofillOutputSchema',
  },
} as const;

export type AvailableFlowName = keyof typeof availableFlows;
