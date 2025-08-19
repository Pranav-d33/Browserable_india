// Example usage of the Browser Client
// This file demonstrates how to use the browser automation API

import { createBrowserClient } from '@bharat-agents/shared';

async function example() {
  // Create a browser client
  const client = createBrowserClient({
    baseUrl: 'http://localhost:3001', // Browser API runs on port 3001
    timeout: 30000,
  });

  try {
    console.log('🚀 Launching browser session...');

    // Launch a new browser session
    const { sessionId } = await client.launchSession();
    console.log(`✅ Session launched: ${sessionId}`);

    // Navigate to a website
    console.log('🌐 Navigating to example.com...');
    const navigateAction = await client.navigate(
      sessionId,
      'https://example.com'
    );
    console.log(`✅ Navigation action created: ${navigateAction.id}`);

    // Wait a moment for the page to load
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Take a screenshot
    console.log('📸 Taking screenshot...');
    const screenshotAction = await client.screenshot(
      sessionId,
      'https://example.com'
    );
    console.log(`✅ Screenshot action created: ${screenshotAction.id}`);

    // Extract the page title
    console.log('📄 Extracting page title...');
    const extractAction = await client.extract(
      sessionId,
      'https://example.com'
    );
    console.log(`✅ Extract action created: ${extractAction.id}`);

    // Wait for actions to complete and check results
    console.log('⏳ Waiting for actions to complete...');

    // Check navigation result
    const navigateResult = await client.getAction(navigateAction.id);
    console.log('Navigation status:', navigateResult.status);

    // Check screenshot result
    const screenshotResult = await client.getAction(screenshotAction.id);
    console.log('Screenshot status:', screenshotResult.status);

    // Check extract result
    const extractResult = await client.getAction(extractAction.id);
    console.log('Extract status:', extractResult.status);

    // List all actions
    const actions = await client.getActions({ limit: 10 });
    console.log(`📋 Total actions: ${actions.pagination.total}`);

    // List active sessions
    const sessions = await client.listSessions();
    console.log(`🔗 Active sessions: ${sessions.length}`);

    // Close the session
    console.log('🔒 Closing browser session...');
    await client.closeSession(sessionId);
    console.log('✅ Session closed successfully');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Run the example
example().catch(console.error);
