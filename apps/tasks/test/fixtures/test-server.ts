import express from 'express';
import { createServer } from 'http';
import { AddressInfo } from 'net';

export interface TestServer {
  app: express.Application;
  server: any;
  port: number;
  url: string;
  close: () => Promise<void>;
}

/**
 * Create a test server with sample pages for e2e testing
 */
export function createTestServer(): TestServer {
  const app = express();
  
  // Serve static HTML pages for testing
  app.get('/test-form', (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Test Form</title>
      </head>
      <body>
        <h1>Test Form</h1>
        <form id="test-form" action="/submit" method="post">
          <div>
            <label for="name">Name:</label>
            <input type="text" id="name" name="name" required>
          </div>
          <div>
            <label for="email">Email:</label>
            <input type="email" id="email" name="email" required>
          </div>
          <div>
            <label for="message">Message:</label>
            <textarea id="message" name="message" rows="4"></textarea>
          </div>
          <button type="submit" id="submit-btn">Submit</button>
        </form>
      </body>
      </html>
    `);
  });

  app.get('/test-price', (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Test Product</title>
      </head>
      <body>
        <h1>Test Product</h1>
        <div class="product">
          <h2>Sample Product</h2>
          <div class="price" id="price">$29.99</div>
          <div class="description">This is a test product for price monitoring.</div>
        </div>
      </body>
      </html>
    `);
  });

  app.post('/submit', (req, res) => {
    // Simulate form submission
    res.redirect('/success');
  });

  app.get('/success', (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Success</title>
      </head>
      <body>
        <h1>Form Submitted Successfully!</h1>
        <p>Thank you for your submission.</p>
      </body>
      </html>
    `);
  });

  const server = createServer(app);
  
  return {
    app,
    server,
    port: 0, // Will be assigned by OS
    url: '',
    close: () => new Promise<void>((resolve) => {
      server.close(() => resolve());
    }),
  };
}

/**
 * Start the test server on an ephemeral port
 */
export async function startTestServer(): Promise<TestServer> {
  const testServer = createTestServer();
  
  return new Promise((resolve) => {
    testServer.server.listen(0, () => {
      const address = testServer.server.address() as AddressInfo;
      testServer.port = address.port;
      testServer.url = `http://localhost:${address.port}`;
      resolve(testServer);
    });
  });
}
