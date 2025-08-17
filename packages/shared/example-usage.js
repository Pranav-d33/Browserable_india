// Example usage of the shared package modules

const { 
  // IDs
  newRunId, 
  newUserId, 
  isId,
  
  // RBAC
  requireRole, 
  requireAdmin, 
  requireUser,
  
  // Metrics
  recordAgentRun, 
  recordLLMTokens, 
  recordLLMCost,
  
  // Costs
  trackLLMCost, 
  calculateTotalCost,
  
  // Telemetry
  startTelemetry, 
  shutdownTelemetry
} = require('./dist/index.js');

// Example 1: Using IDs
console.log('=== ID Generation ===');
const runId = newRunId();
const userId = newUserId();
console.log('Run ID:', runId);
console.log('User ID:', userId);
console.log('Is valid ID:', isId(runId));

// Example 2: Using Cost Tracking
console.log('\n=== Cost Tracking ===');
const cost = trackLLMCost({
  provider: 'openai',
  model: 'gpt-4',
  inputTokens: 1000,
  outputTokens: 500
});
console.log('LLM Cost:', cost);

// Example 3: Using Metrics
console.log('\n=== Metrics ===');
recordAgentRun('test-agent', 'success', 2.5);
recordLLMTokens('openai', 'gpt-4', 'input', 1000);
recordLLMTokens('openai', 'gpt-4', 'output', 500);

// Example 4: Express middleware usage (conceptual)
console.log('\n=== Express Middleware Example ===');
console.log('// In your Express app:');
console.log('app.use("/admin", requireAdmin);');
console.log('app.use("/api", requireUser);');
console.log('app.use("/service", requireRole(["service"]));');

// Example 5: Telemetry setup (conceptual)
console.log('\n=== Telemetry Setup ===');
console.log('// In your app startup:');
console.log('await startTelemetry();');
console.log('');
console.log('// In your app shutdown:');
console.log('await shutdownTelemetry();');

// Example 6: Cost calculations
console.log('\n=== Cost Calculations ===');
const totalCost = calculateTotalCost('anthropic', 'claude-3-sonnet', 2000, 1000);
console.log('Claude 3 Sonnet cost for 2000 input + 1000 output tokens:', totalCost);

console.log('\n=== Example Complete ===');
