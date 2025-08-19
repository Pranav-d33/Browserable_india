import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
// import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

import { env } from './env';

let sdk: NodeSDK | null = null;

/**
 * Start OpenTelemetry instrumentation
 */
export async function startTelemetry(): Promise<void> {
  if (sdk) {
    console.warn('OpenTelemetry SDK already initialized');
    return;
  }

  try {
    // Create resource with service name from environment
    const resource = new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]:
        env.SERVICE_NAME || 'bharat-agents',
      [SemanticResourceAttributes.SERVICE_VERSION]:
        env.SERVICE_VERSION || '1.0.0',
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]:
        env.NODE_ENV || 'development',
    });

    // Create OTLP exporters
    const traceExporter = new OTLPTraceExporter({
      url: env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
      headers: env.OTEL_EXPORTER_OTLP_HEADERS
        ? JSON.parse(env.OTEL_EXPORTER_OTLP_HEADERS)
        : {},
    });

    // Metrics exporter initializable later if needed

    // Create SDK with auto-instrumentations
    sdk = new NodeSDK({
      resource,
      traceExporter,
      metricReader: undefined,
      instrumentations: [
        getNodeAutoInstrumentations({
          // Configure auto-instrumentations
          '@opentelemetry/instrumentation-http': {
            ignoreIncomingPaths: ['/health', '/metrics', '/favicon.ico'],
          },
          '@opentelemetry/instrumentation-express': {
            ignoreLayers: ['/health', '/metrics'],
          },
        }),
      ],
    });

    // Initialize the SDK
    await sdk.start();

    console.log('OpenTelemetry SDK initialized successfully');
  } catch (error) {
    console.error('Failed to initialize OpenTelemetry SDK:', error);
    // Don't throw - telemetry failure shouldn't break the application
  }
}

/**
 * Shutdown OpenTelemetry instrumentation
 */
export async function shutdownTelemetry(): Promise<void> {
  if (!sdk) {
    return;
  }

  try {
    await sdk.shutdown();
    sdk = null;
    console.log('OpenTelemetry SDK shutdown successfully');
  } catch (error) {
    console.error('Failed to shutdown OpenTelemetry SDK:', error);
  }
}

/**
 * Check if telemetry is initialized
 */
export function isTelemetryInitialized(): boolean {
  return sdk !== null;
}

/**
 * Get the current SDK instance (for advanced usage)
 */
export function getSDK(): NodeSDK | null {
  return sdk;
}
