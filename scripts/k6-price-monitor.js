import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const priceMonitorLatency = new Trend('price_monitor_latency');

// Test configuration
export const options = {
  stages: [
    // Ramp up to 50 VUs over 30 seconds
    { duration: '30s', target: 50 },
    // Stay at 50 VUs for 2 minutes
    { duration: '2m', target: 50 },
    // Ramp down to 0 VUs over 30 seconds
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    // 95% of requests must complete within 5 seconds
    'price_monitor_latency': ['p(95)<5000'],
    // Error rate must be less than 5%
    'errors': ['rate<0.05'],
    // HTTP request duration must be less than 3 seconds for 95% of requests
    'http_req_duration': ['p(95)<3000'],
  },
};

// Test data - sample product URLs for price monitoring
const testUrls = [
  'https://example.com/product1',
  'https://example.com/product2',
  'https://example.com/product3',
  'https://example.com/product4',
  'https://example.com/product5',
];

const selectors = [
  '.price',
  '#price',
  '[data-price]',
  '.product-price',
  '.cost',
];

// Helper function to get random test data
function getRandomTestData() {
  const randomUrl = testUrls[Math.floor(Math.random() * testUrls.length)];
  const randomSelector = selectors[Math.floor(Math.random() * selectors.length)];
  
  return {
    productUrl: randomUrl,
    selector: randomSelector,
  };
}

// Main test function
export default function () {
  const testData = getRandomTestData();
  
  // Prepare request payload
  const payload = JSON.stringify({
    productUrl: testData.productUrl,
    selector: testData.selector,
  });

  // Set request headers
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer test-token',
    'User-Agent': 'k6-load-test/1.0',
  };

  // Make request to price monitor flow
  const startTime = Date.now();
  const response = http.post(
    `${__ENV.TASKS_URL || 'http://localhost:3001'}/v1/flows/price-monitor`,
    payload,
    { headers }
  );
  const endTime = Date.now();
  const latency = endTime - startTime;

  // Record custom metrics
  priceMonitorLatency.add(latency);
  errorRate.add(response.status !== 200);

  // Verify response
  const success = check(response, {
    'status is 200': (r) => r.status === 200,
    'response has runId': (r) => r.json('runId') !== undefined,
    'response has status': (r) => r.json('status') !== undefined,
    'response has agent': (r) => r.json('agent') === 'BROWSER',
    'response has output': (r) => r.json('output') !== undefined,
    'response time < 5s': (r) => r.timings.duration < 5000,
  });

  // Log errors
  if (!success) {
    console.error(`Request failed: ${response.status} - ${response.body}`);
  }

  // Add some think time between requests
  sleep(Math.random() * 2 + 1); // Random sleep between 1-3 seconds
}

// Setup function (runs once before the test)
export function setup() {
  console.log('Starting k6 load test for price monitor flow');
  console.log(`Target URL: ${__ENV.TASKS_URL || 'http://localhost:3001'}`);
  console.log('Test configuration:');
  console.log('- 50 VUs for 2 minutes');
  console.log('- Ramp up/down: 30 seconds each');
  console.log('- P95 latency threshold: 5 seconds');
  console.log('- Error rate threshold: 5%');
}

// Teardown function (runs once after the test)
export function teardown(data) {
  console.log('Load test completed');
  console.log('Summary:');
  console.log(`- Total requests: ${data.metrics.http_reqs?.count || 0}`);
  console.log(`- Average response time: ${data.metrics.http_req_duration?.avg || 0}ms`);
  console.log(`- P95 response time: ${data.metrics.http_req_duration?.['p(95)'] || 0}ms`);
  console.log(`- Error rate: ${(data.metrics.errors?.rate || 0) * 100}%`);
}

// Handle test results
export function handleSummary(data) {
  return {
    'load-test-results.json': JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}

// Text summary function
function textSummary(data, options) {
  const { metrics, root_group } = data;
  const { http_reqs, http_req_duration, errors } = metrics;
  
  return `
Load Test Results - Price Monitor Flow
=====================================

Test Configuration:
- Virtual Users: 50
- Duration: 3 minutes (30s ramp up, 2m steady, 30s ramp down)
- Target: ${__ENV.TASKS_URL || 'http://localhost:3001'}/v1/flows/price-monitor

Performance Metrics:
- Total Requests: ${http_reqs?.count || 0}
- Requests/sec: ${http_reqs?.rate?.toFixed(2) || 0}
- Average Response Time: ${http_req_duration?.avg?.toFixed(2) || 0}ms
- Median Response Time: ${http_req_duration?.med?.toFixed(2) || 0}ms
- P95 Response Time: ${http_req_duration?.['p(95)']?.toFixed(2) || 0}ms
- P99 Response Time: ${http_req_duration?.['p(99)']?.toFixed(2) || 0}ms
- Min Response Time: ${http_req_duration?.min?.toFixed(2) || 0}ms
- Max Response Time: ${http_req_duration?.max?.toFixed(2) || 0}ms

Error Metrics:
- Error Rate: ${((errors?.rate || 0) * 100).toFixed(2)}%
- Total Errors: ${errors?.count || 0}

Threshold Results:
- P95 Latency < 5s: ${http_req_duration?.['p(95)'] < 5000 ? 'PASS' : 'FAIL'}
- Error Rate < 5%: ${(errors?.rate || 0) < 0.05 ? 'PASS' : 'FAIL'}

Custom Metrics:
- Price Monitor Latency (P95): ${data.metrics.price_monitor_latency?.['p(95)']?.toFixed(2) || 0}ms
- Price Monitor Latency (Avg): ${data.metrics.price_monitor_latency?.avg?.toFixed(2) || 0}ms
`;
}
