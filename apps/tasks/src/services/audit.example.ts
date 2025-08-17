import { record, getAuditLogs, getAuditStats, type AuditEvent } from './audit.js';

/**
 * Example usage of the audit service
 */
async function exampleUsage() {
  console.log('=== Audit Service Examples ===\n');

  // Example 1: Basic audit event recording
  console.log('1. Recording a basic audit event...');
  await record({
    runId: 'run-123',
    action: 'browser_session_created',
    status: 'OK',
    durationMs: 150,
  });
  console.log('✓ Basic audit event recorded\n');

  // Example 2: Audit event with payload and result
  console.log('2. Recording an audit event with payload and result...');
  await record({
    runId: 'run-123',
    nodeId: 'node-456',
    userId: 'user-789',
    action: 'llm_completion',
    payload: {
      model: 'gpt-3.5-turbo',
      prompt: 'What is the capital of France?',
      temperature: 0.7,
      maxTokens: 100,
    },
    result: {
      text: 'The capital of France is Paris.',
      inputTokens: 8,
      outputTokens: 12,
    },
    status: 'OK',
    durationMs: 2500,
  });
  console.log('✓ Audit event with payload and result recorded\n');

  // Example 3: Audit event with sensitive data (will be redacted)
  console.log('3. Recording an audit event with sensitive data...');
  await record({
    runId: 'run-123',
    action: 'api_call',
    payload: {
      endpoint: '/api/data',
      headers: {
        'Authorization': 'Bearer sk-1234567890abcdef',
        'Content-Type': 'application/json',
      },
      body: {
        username: 'testuser',
        password: 'secretpassword123',
        api_key: 'sk-abcdef1234567890',
      },
    },
    result: {
      statusCode: 200,
      response: { success: true, data: 'sensitive data here' },
    },
    status: 'OK',
    durationMs: 500,
  });
  console.log('✓ Audit event with sensitive data recorded (redacted)\n');

  // Example 4: Error audit event
  console.log('4. Recording an error audit event...');
  await record({
    runId: 'run-123',
    nodeId: 'node-789',
    action: 'database_query',
    payload: {
      query: 'SELECT * FROM users WHERE id = ?',
      params: ['user-123'],
    },
    result: {
      error: 'Connection timeout',
      errorCode: 'DB_TIMEOUT',
    },
    status: 'ERR',
    durationMs: 5000,
  });
  console.log('✓ Error audit event recorded\n');

  // Example 5: Large payload (will be truncated)
  console.log('5. Recording an audit event with large payload...');
  const largePayload = {
    data: new Array(50000).fill('x'.repeat(50)), // Very large array
    metadata: {
      description: 'Large dataset for processing',
      size: '2.5MB',
    },
  };
  
  await record({
    runId: 'run-123',
    action: 'data_processing',
    payload: largePayload,
    result: { processed: true, records: 50000 },
    status: 'OK',
    durationMs: 15000,
  });
  console.log('✓ Large payload audit event recorded (truncated)\n');

  // Example 6: Retrieving audit logs
  console.log('6. Retrieving audit logs...');
  try {
    const logs = await getAuditLogs('run-123', undefined, 10);
    console.log(`✓ Retrieved ${logs.logs.length} audit logs`);
    console.log(`  Has more: ${logs.hasMore}`);
    console.log(`  Next cursor: ${logs.nextCursor || 'None'}`);
    
    if (logs.logs.length > 0) {
      console.log('  Sample log:');
      const sampleLog = logs.logs[0];
      console.log(`    Action: ${sampleLog.action}`);
      console.log(`    Status: ${sampleLog.status}`);
      console.log(`    Duration: ${sampleLog.durationMs}ms`);
      console.log(`    Created: ${sampleLog.createdAt}`);
    }
  } catch (error) {
    console.log('⚠ Could not retrieve audit logs (database not available)');
  }
  console.log();

  // Example 7: Getting audit statistics
  console.log('7. Getting audit statistics...');
  try {
    const stats = await getAuditStats('run-123');
    console.log('✓ Audit statistics retrieved:');
    console.log(`  Total events: ${stats.totalEvents}`);
    console.log(`  Success count: ${stats.successCount}`);
    console.log(`  Error count: ${stats.errorCount}`);
    console.log(`  Average duration: ${stats.averageDuration}ms`);
    console.log(`  Actions: ${stats.actions.map(a => `${a.action}(${a.count})`).join(', ')}`);
  } catch (error) {
    console.log('⚠ Could not retrieve audit statistics (database not available)');
  }
  console.log();

  console.log('=== Examples completed ===');
}

/**
 * Example of integrating audit logging into other services
 */
function integrationExample() {
  console.log('=== Integration Example ===\n');

  // Example: Wrapping a function with audit logging
  async function auditedFunction<T>(
    runId: string,
    action: string,
    fn: () => Promise<T>
  ): Promise<T> {
    const startTime = Date.now();
    
    try {
      const result = await fn();
      
      // Record success
      await record({
        runId,
        action,
        status: 'OK',
        durationMs: Date.now() - startTime,
        result: { success: true, data: result },
      });
      
      return result;
    } catch (error) {
      // Record error
      await record({
        runId,
        action,
        status: 'ERR',
        durationMs: Date.now() - startTime,
        result: { 
          error: error instanceof Error ? error.message : String(error),
          success: false,
        },
      });
      
      throw error;
    }
  }

  // Example usage of the audited function
  const exampleFunction = async () => {
    // Simulate some work
    await new Promise(resolve => setTimeout(resolve, 100));
    return { message: 'Hello, World!' };
  };

  console.log('Example of audited function wrapper:');
  console.log('const result = await auditedFunction(runId, "example_action", exampleFunction);');
  console.log();

  // Example: Audit decorator pattern
  function auditDecorator(runId: string, action: string) {
    return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
      const method = descriptor.value;
      
      descriptor.value = async function (...args: any[]) {
        const startTime = Date.now();
        
        try {
          const result = await method.apply(this, args);
          
          await record({
            runId,
            action: `${action}_${propertyName}`,
            status: 'OK',
            durationMs: Date.now() - startTime,
            payload: { args },
            result: { success: true, data: result },
          });
          
          return result;
        } catch (error) {
          await record({
            runId,
            action: `${action}_${propertyName}`,
            status: 'ERR',
            durationMs: Date.now() - startTime,
            payload: { args },
            result: { 
              error: error instanceof Error ? error.message : String(error),
              success: false,
            },
          });
          
          throw error;
        }
      };
    };
  }

  console.log('Example of audit decorator:');
  console.log('class MyService {');
  console.log('  @auditDecorator("run-123", "my_service")');
  console.log('  async doSomething() { ... }');
  console.log('}');
  console.log();

  console.log('=== Integration Example completed ===');
}

// Run examples if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  exampleUsage()
    .then(() => integrationExample())
    .catch(console.error);
}
