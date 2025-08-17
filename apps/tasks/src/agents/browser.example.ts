import { BrowserAgent } from './browser.js';

/**
 * Example usage of the browser agent
 */
async function exampleUsage() {
  console.log('=== Browser Agent Examples ===\n');

  const agent = new BrowserAgent();

  // Example 1: Basic browser automation with provided steps
  console.log('1. Basic browser automation with provided steps...');
  const basicResult = await agent.runNode({
    runId: 'run-123',
    nodeId: 'node-456',
    input: JSON.stringify({
      instructions: 'Navigate to example.com and take a screenshot',
      steps: [
        { action: 'goto', url: 'https://example.com' },
        { action: 'wait', wait: 2000 },
        { action: 'screenshot' },
      ],
    }),
  });

  console.log('✓ Basic automation completed');
  console.log(`  Output: ${basicResult.output.substring(0, 100)}...`);
  console.log(`  Success: ${basicResult.meta?.success}`);
  console.log(`  Steps: ${basicResult.meta?.steps}`);
  console.log(`  Duration: ${basicResult.meta?.duration}ms`);
  console.log();

  // Example 2: LLM-generated steps from instructions
  console.log('2. LLM-generated steps from instructions...');
  const llmResult = await agent.runNode({
    runId: 'run-123',
    nodeId: 'node-789',
    input: JSON.stringify({
      instructions: 'Go to example.com, click the "Get Started" button, and extract the page title',
    }),
  });

  console.log('✓ LLM-generated automation completed');
  console.log(`  Output: ${llmResult.output.substring(0, 100)}...`);
  console.log(`  Success: ${llmResult.meta?.success}`);
  console.log();

  // Example 3: Data extraction
  console.log('3. Data extraction example...');
  const extractResult = await agent.runNode({
    runId: 'run-123',
    nodeId: 'node-101',
    input: JSON.stringify({
      instructions: 'Extract user profile information',
      steps: [
        { action: 'goto', url: 'https://example.com/profile' },
        { action: 'wait', wait: 1000 },
        { action: 'extract', selector: '.user-name', extract: true },
        { action: 'extract', selector: '.user-email', extract: true },
        { action: 'extract', selector: '.user-bio', extract: true },
      ],
    }),
  });

  console.log('✓ Data extraction completed');
  console.log(`  Output: ${extractResult.output.substring(0, 100)}...`);
  console.log(`  Success: ${extractResult.meta?.success}`);
  console.log();

  // Example 4: Form interaction
  console.log('4. Form interaction example...');
  const formResult = await agent.runNode({
    runId: 'run-123',
    nodeId: 'node-202',
    input: JSON.stringify({
      instructions: 'Fill out and submit a contact form',
      steps: [
        { action: 'goto', url: 'https://example.com/contact' },
        { action: 'wait', wait: 1000 },
        { action: 'type', selector: 'input[name="name"]', text: 'John Doe' },
        { action: 'type', selector: 'input[name="email"]', text: 'john@example.com' },
        { action: 'type', selector: 'textarea[name="message"]', text: 'Hello, this is a test message.' },
        { action: 'click', selector: 'button[type="submit"]' },
        { action: 'wait', wait: 2000 },
        { action: 'screenshot' },
      ],
    }),
  });

  console.log('✓ Form interaction completed');
  console.log(`  Output: ${formResult.output.substring(0, 100)}...`);
  console.log(`  Success: ${formResult.meta?.success}`);
  console.log();

  // Example 5: Keep session alive
  console.log('5. Keep session alive example...');
  const keepAliveResult = await agent.runNode({
    runId: 'run-123',
    nodeId: 'node-303',
    input: JSON.stringify({
      instructions: 'Navigate to a page and keep the session alive for further interaction',
      steps: [
        { action: 'goto', url: 'https://example.com' },
        { action: 'click', selector: 'a[href="/login"]' },
      ],
      keepAlive: true, // Session will remain open
    }),
  });

  console.log('✓ Keep alive example completed');
  console.log(`  Output: ${keepAliveResult.output.substring(0, 100)}...`);
  console.log(`  Success: ${keepAliveResult.meta?.success}`);
  console.log('  Note: Session is kept alive for further interaction');
  console.log();

  console.log('=== Examples completed ===');
}

/**
 * Example of complex web scraping workflow
 */
async function complexWorkflowExample() {
  console.log('=== Complex Web Scraping Workflow ===\n');

  const agent = new BrowserAgent();

  // Example: E-commerce product scraping
  console.log('E-commerce product scraping workflow...');
  const scrapingResult = await agent.runNode({
    runId: 'run-456',
    nodeId: 'node-789',
    input: JSON.stringify({
      instructions: 'Scrape product information from an e-commerce site',
      steps: [
        // Navigate to the site
        { action: 'goto', url: 'https://example-store.com' },
        { action: 'wait', wait: 2000 },
        
        // Search for products
        { action: 'click', selector: '.search-input' },
        { action: 'type', selector: '.search-input', text: 'laptop' },
        { action: 'click', selector: '.search-button' },
        { action: 'wait', wait: 3000 },
        
        // Extract product listings
        { action: 'extract', selector: '.product-grid', extract: true },
        
        // Click on first product
        { action: 'click', selector: '.product-item:first-child' },
        { action: 'wait', wait: 2000 },
        
        // Extract detailed product information
        { action: 'extract', selector: '.product-title', extract: true },
        { action: 'extract', selector: '.product-price', extract: true },
        { action: 'extract', selector: '.product-description', extract: true },
        { action: 'extract', selector: '.product-rating', extract: true },
        
        // Take screenshot of the product page
        { action: 'screenshot' },
      ],
    }),
  });

  console.log('✓ Complex scraping workflow completed');
  console.log(`  Output: ${scrapingResult.output.substring(0, 150)}...`);
  console.log(`  Success: ${scrapingResult.meta?.success}`);
  console.log(`  Steps executed: ${scrapingResult.meta?.steps}`);
  console.log(`  Duration: ${scrapingResult.meta?.duration}ms`);
  console.log();

  console.log('=== Complex Workflow Example completed ===');
}

/**
 * Example of error handling and retry logic
 */
function errorHandlingExample() {
  console.log('=== Error Handling Examples ===\n');

  console.log('The browser agent includes robust error handling:');
  console.log('• Automatic retries for transient failures');
  console.log('• Step-by-step error tracking');
  console.log('• Graceful degradation when elements are not found');
  console.log('• Timeout handling for slow-loading pages');
  console.log('• Session cleanup on errors');
  console.log();

  console.log('Example error scenarios handled:');
  console.log('• Network connectivity issues');
  console.log('• Page load timeouts');
  console.log('• Element not found errors');
  console.log('• JavaScript execution errors');
  console.log('• Browser service unavailability');
  console.log();

  console.log('=== Error Handling Examples completed ===');
}

/**
 * Example of environment configuration
 */
function configurationExample() {
  console.log('=== Configuration Examples ===\n');

  console.log('Environment variables for browser agent:');
  console.log(`• BROWSER_MAX_STEPS: ${process.env.BROWSER_MAX_STEPS || '30'} (default)`);
  console.log(`• BROWSER_MAX_DURATION_MS: ${process.env.BROWSER_MAX_DURATION_MS || '90000'} (default)`);
  console.log(`• BROWSER_SERVICE_URL: ${process.env.BROWSER_SERVICE_URL || 'http://localhost:3001'}`);
  console.log(`• ARTIFACT_BASE_URL: ${process.env.ARTIFACT_BASE_URL || 'http://localhost:3000/artifacts'}`);
  console.log();

  console.log('Example configuration:');
  console.log('export BROWSER_MAX_STEPS=50');
  console.log('export BROWSER_MAX_DURATION_MS=120000');
  console.log('export BROWSER_SERVICE_URL=https://browser-service.example.com');
  console.log('export ARTIFACT_BASE_URL=https://artifacts.example.com');
  console.log();

  console.log('=== Configuration Examples completed ===');
}

// Run examples if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  exampleUsage()
    .then(() => complexWorkflowExample())
    .then(() => errorHandlingExample())
    .then(() => configurationExample())
    .catch(console.error);
}
