import { createBrowserClient, ConsoleAuditLogger } from './browserClient';

// =============================================================================
// Browser Client Example Usage
// =============================================================================

async function browserClientExample() {
  console.log('=== Browser Client Example ===\n');

  // Create browser client with audit logging
  const auditLogger = new ConsoleAuditLogger();
  const browserClient = createBrowserClient(
    'http://localhost:3002', // Browser service URL
    {
      timeout: 30000,
      retries: 3,
      retryDelay: 1000,
      enableAuditLog: true,
    },
    auditLogger
  );

  let sessionId: string;

  try {
    // Example 1: Create a browser session
    console.log('1. Creating browser session...');
    sessionId = await browserClient.createSession();
    console.log(`Session created: ${sessionId}\n`);

    // Example 2: Navigate to a website
    console.log('2. Navigating to example.com...');
    const navigateAction = await browserClient.goto(sessionId, 'https://example.com');
    console.log(`Navigation action ID: ${navigateAction.id}`);
    console.log(`Status: ${navigateAction.status}\n`);

    // Example 3: Wait for action completion
    console.log('3. Waiting for navigation to complete...');
    const completedAction = await browserClient.waitForAction(navigateAction.id);
    console.log(`Action completed: ${completedAction.status}`);
    if (completedAction.result?.success) {
      console.log('Navigation successful!\n');
    }

    // Example 4: Take a screenshot
    console.log('4. Taking screenshot...');
    const screenshotAction = await browserClient.screenshot(sessionId, 'https://example.com');
    await browserClient.waitForAction(screenshotAction.id);
    console.log('Screenshot taken successfully!\n');

    // Example 5: Extract content
    console.log('5. Extracting page content...');
    const extractAction = await browserClient.extract(sessionId, 'https://example.com', 'h1');
    const extractResult = await browserClient.waitForAction(extractAction.id);
    if (extractResult.result?.success) {
      console.log('Extracted content:', extractResult.result.data);
    }
    console.log('');

    // Example 6: List all actions
    console.log('6. Listing all actions...');
    const actions = await browserClient.getActions({ limit: 10 });
    console.log(`Total actions: ${actions.pagination.total}`);
    console.log(`Actions in this page: ${actions.actions.length}`);
    actions.actions.forEach(action => {
      console.log(`  - ${action.type}: ${action.url} (${action.status})`);
    });
    console.log('');

    // Example 7: List all sessions
    console.log('7. Listing all sessions...');
    const sessions = await browserClient.listSessions();
    console.log(`Active sessions: ${sessions.length}`);
    sessions.forEach(session => {
      console.log(`  - ${session.sessionId}: ${session.isActive ? 'Active' : 'Inactive'}`);
    });
    console.log('');

  } catch (error) {
    console.error('Error in browser client example:', error);
  } finally {
    // Example 8: Clean up - close session
    if (sessionId) {
      console.log('8. Closing browser session...');
      try {
        await browserClient.closeSession(sessionId);
        console.log('Session closed successfully!\n');
      } catch (error) {
        console.error('Error closing session:', error);
      }
    }
  }

  console.log('=== Example completed ===');
}

// =============================================================================
// Advanced Example: Web Scraping Workflow
// =============================================================================

async function webScrapingExample() {
  console.log('=== Web Scraping Example ===\n');

  const browserClient = createBrowserClient('http://localhost:3002');
  let sessionId: string;

  try {
    // Create session
    sessionId = await browserClient.createSession();
    console.log(`Session created: ${sessionId}`);

    // Navigate to a search engine
    const navigateAction = await browserClient.goto(sessionId, 'https://www.google.com');
    await browserClient.waitForAction(navigateAction.id);
    console.log('Navigated to Google');

    // Wait for search box to appear
    const waitAction = await browserClient.waitFor(sessionId, 'https://www.google.com', 'input[name="q"]');
    await browserClient.waitForAction(waitAction.id);
    console.log('Search box is ready');

    // Type search query
    const typeAction = await browserClient.type(sessionId, 'https://www.google.com', 'input[name="q"]', 'web scraping');
    await browserClient.waitForAction(typeAction.id);
    console.log('Typed search query');

    // Click search button
    const clickAction = await browserClient.click(sessionId, 'https://www.google.com', 'input[name="btnK"]');
    await browserClient.waitForAction(clickAction.id);
    console.log('Clicked search button');

    // Wait for results
    const waitResultsAction = await browserClient.waitFor(sessionId, 'https://www.google.com', '#search');
    await browserClient.waitForAction(waitResultsAction.id);
    console.log('Search results loaded');

    // Extract search results
    const extractAction = await browserClient.extract(sessionId, 'https://www.google.com', '.g');
    const extractResult = await browserClient.waitForAction(extractAction.id);
    if (extractResult.result?.success) {
      console.log('Search results extracted');
    }

    // Take screenshot of results
    const screenshotAction = await browserClient.screenshot(sessionId, 'https://www.google.com');
    await browserClient.waitForAction(screenshotAction.id);
    console.log('Screenshot taken');

  } catch (error) {
    console.error('Error in web scraping example:', error);
  } finally {
    if (sessionId) {
      await browserClient.closeSession(sessionId);
      console.log('Session closed');
    }
  }

  console.log('=== Web scraping example completed ===');
}

// =============================================================================
// Error Handling Example
// =============================================================================

async function errorHandlingExample() {
  console.log('=== Error Handling Example ===\n');

  const browserClient = createBrowserClient('http://localhost:3002');

  try {
    // Try to navigate to an invalid URL
    console.log('1. Testing invalid URL...');
    const sessionId = await browserClient.createSession();
    
    try {
      await browserClient.goto(sessionId, 'not-a-valid-url');
    } catch (error) {
      console.log('Expected error caught:', error instanceof Error ? error.message : error);
    }

    // Try to click on non-existent element
    console.log('\n2. Testing non-existent element...');
    try {
      await browserClient.click(sessionId, 'https://example.com', '#non-existent-element');
    } catch (error) {
      console.log('Expected error caught:', error instanceof Error ? error.message : error);
    }

    await browserClient.closeSession(sessionId);

  } catch (error) {
    console.error('Unexpected error:', error);
  }

  console.log('\n=== Error handling example completed ===');
}

// =============================================================================
// Configuration Example
// =============================================================================

async function configurationExample() {
  console.log('=== Configuration Example ===\n');

  // Create client with custom configuration
  const browserClient = createBrowserClient('http://localhost:3002', {
    timeout: 60000, // 60 seconds
    retries: 5,     // 5 retries
    retryDelay: 2000, // 2 seconds between retries
    enableAuditLog: true,
  });

  // Update configuration at runtime
  browserClient.setConfig({ timeout: 45000 });
  browserClient.setRetryConfig({ maxRetries: 3 });

  console.log('Browser client configured with custom settings');
  console.log('=== Configuration example completed ===');
}

// =============================================================================
// Run Examples
// =============================================================================

async function runAllExamples() {
  try {
    await browserClientExample();
    console.log('\n' + '='.repeat(50) + '\n');
    
    await webScrapingExample();
    console.log('\n' + '='.repeat(50) + '\n');
    
    await errorHandlingExample();
    console.log('\n' + '='.repeat(50) + '\n');
    
    await configurationExample();
    
  } catch (error) {
    console.error('Error running examples:', error);
  }
}

// Run examples if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllExamples().catch(console.error);
}

export {
  browserClientExample,
  webScrapingExample,
  errorHandlingExample,
  configurationExample,
  runAllExamples,
};
