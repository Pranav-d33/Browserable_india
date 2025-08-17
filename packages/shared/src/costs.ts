import { recordLLMCost } from './metrics';

// LLM Provider types
export type LLMProvider = 'openai' | 'anthropic' | 'groq';

// Model types
export type ModelType =
  | 'gpt-4'
  | 'gpt-3.5-turbo'
  | 'claude-3'
  | 'claude-2'
  | 'llama'
  | 'mixtral';

// Pricing table (per 1K tokens) in USD
export const MODEL_PRICING: Record<
  LLMProvider,
  Record<string, { input: number; output: number }>
> = {
  openai: {
    'gpt-4': { input: 0.03, output: 0.06 },
    'gpt-4-turbo': { input: 0.01, output: 0.03 },
    'gpt-4o': { input: 0.005, output: 0.015 },
    'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
    'gpt-3.5-turbo': { input: 0.0015, output: 0.002 },
    'gpt-3.5-turbo-16k': { input: 0.003, output: 0.004 },
  },
  anthropic: {
    'claude-3-opus': { input: 0.015, output: 0.075 },
    'claude-3-sonnet': { input: 0.003, output: 0.015 },
    'claude-3-haiku': { input: 0.00025, output: 0.00125 },
    'claude-2.1': { input: 0.008, output: 0.024 },
    'claude-2.0': { input: 0.008, output: 0.024 },
    'claude-instant': { input: 0.00163, output: 0.00551 },
  },
  groq: {
    'llama-3.1-8b-instant': { input: 0.00005, output: 0.0001 },
    'llama-3.1-70b-versatile': { input: 0.00059, output: 0.0008 },
    'llama-3.1-405b-reasoning': { input: 0.0029, output: 0.0039 },
    'llama-3.1-8b-instant-2': { input: 0.00005, output: 0.0001 },
    'mixtral-8x7b-32768': { input: 0.00024, output: 0.00024 },
    'gemma-7b-it': { input: 0.0001, output: 0.0001 },
  },
};

/**
 * Get pricing for a specific model
 */
export function getModelPricing(
  provider: LLMProvider,
  model: string
): { input: number; output: number } | null {
  const providerPricing = MODEL_PRICING[provider];
  if (!providerPricing) {
    return null;
  }

  return providerPricing[model] || null;
}

/**
 * Calculate cost for input tokens
 */
export function calculateInputCost(
  provider: LLMProvider,
  model: string,
  inputTokens: number
): number {
  const pricing = getModelPricing(provider, model);
  if (!pricing) {
    console.warn(`No pricing found for ${provider}/${model}`);
    return 0;
  }

  return (inputTokens / 1000) * pricing.input;
}

/**
 * Calculate cost for output tokens
 */
export function calculateOutputCost(
  provider: LLMProvider,
  model: string,
  outputTokens: number
): number {
  const pricing = getModelPricing(provider, model);
  if (!pricing) {
    console.warn(`No pricing found for ${provider}/${model}`);
    return 0;
  }

  return (outputTokens / 1000) * pricing.output;
}

/**
 * Calculate total cost for input and output tokens
 */
export function calculateTotalCost(
  provider: LLMProvider,
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const inputCost = calculateInputCost(provider, model, inputTokens);
  const outputCost = calculateOutputCost(provider, model, outputTokens);

  return inputCost + outputCost;
}

/**
 * Track LLM cost and record metrics
 */
export function trackLLMCost(params: {
  provider: LLMProvider;
  model: string;
  inputTokens: number;
  outputTokens: number;
}): number {
  const { provider, model, inputTokens, outputTokens } = params;

  const totalCost = calculateTotalCost(
    provider,
    model,
    inputTokens,
    outputTokens
  );

  // Record the cost in metrics
  recordLLMCost(provider, model, totalCost);

  return totalCost;
}

/**
 * Get all available models for a provider
 */
export function getAvailableModels(provider: LLMProvider): string[] {
  const providerPricing = MODEL_PRICING[provider];
  return providerPricing ? Object.keys(providerPricing) : [];
}

/**
 * Get all supported providers
 */
export function getSupportedProviders(): LLMProvider[] {
  return Object.keys(MODEL_PRICING) as LLMProvider[];
}

/**
 * Check if a model is supported
 */
export function isModelSupported(
  provider: LLMProvider,
  model: string
): boolean {
  return getModelPricing(provider, model) !== null;
}

/**
 * Get the cheapest model for a provider
 */
export function getCheapestModel(
  provider: LLMProvider
): { model: string; pricing: { input: number; output: number } } | null {
  const providerPricing = MODEL_PRICING[provider];
  if (!providerPricing) {
    return null;
  }

  let cheapestModel = '';
  let cheapestPricing = { input: Infinity, output: Infinity };

  for (const [model, pricing] of Object.entries(providerPricing)) {
    const totalCost = pricing.input + pricing.output;
    const cheapestTotalCost = cheapestPricing.input + cheapestPricing.output;

    if (totalCost < cheapestTotalCost) {
      cheapestModel = model;
      cheapestPricing = pricing;
    }
  }

  return cheapestModel
    ? { model: cheapestModel, pricing: cheapestPricing }
    : null;
}

/**
 * Format cost as USD string
 */
export function formatCost(cost: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 6,
    maximumFractionDigits: 6,
  }).format(cost);
}

/**
 * Estimate cost for a text string (rough estimation)
 */
export function estimateTextCost(
  provider: LLMProvider,
  model: string,
  inputText: string,
  outputText?: string
): number {
  // Rough estimation: 1 token ≈ 4 characters for English text
  const inputTokens = Math.ceil(inputText.length / 4);
  const outputTokens = outputText ? Math.ceil(outputText.length / 4) : 0;

  return calculateTotalCost(provider, model, inputTokens, outputTokens);
}
