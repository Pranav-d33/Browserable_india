import { URL } from 'whatwg-url';

/**
 * Validates URL and ensures it only uses HTTP/HTTPS protocols
 */
export function validateURL(urlString: string): {
  isValid: boolean;
  error?: string;
  url?: URL;
} {
  try {
    // Parse URL using whatwg-url
    const url = new URL(urlString);

    // Check protocol - only allow http and https
    if (!['http:', 'https:'].includes(url.protocol)) {
      return {
        isValid: false,
        error: `Protocol '${url.protocol}' is not allowed. Only HTTP and HTTPS are supported.`,
      };
    }

    return { isValid: true, url };
  } catch (error) {
    return {
      isValid: false,
      error: `Invalid URL: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Validates multiple URLs in an array
 */
export function validateURLs(urls: string[]): {
  valid: string[];
  invalid: Array<{ url: string; error: string }>;
} {
  const valid: string[] = [];
  const invalid: Array<{ url: string; error: string }> = [];

  for (const url of urls) {
    const validation = validateURL(url);
    if (validation.isValid) {
      valid.push(url);
    } else {
      invalid.push({ url, error: validation.error || 'Unknown error' });
    }
  }

  return { valid, invalid };
}

/**
 * Sanitizes URL by removing potentially dangerous parts
 */
export function sanitizeURL(urlString: string): string {
  try {
    const url = new URL(urlString);

    // Remove fragments (hash)
    url.hash = '';

    // Ensure protocol is set
    if (!url.protocol) {
      url.protocol = 'https:';
    }

    // Ensure hostname is lowercase
    url.hostname = url.hostname.toLowerCase();

    return url.toString();
  } catch (error) {
    throw new Error(
      `Failed to sanitize URL: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
