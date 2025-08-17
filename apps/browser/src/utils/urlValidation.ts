import { URL } from 'whatwg-url';

/**
 * RFC1918 private IP ranges
 */
const PRIVATE_IP_RANGES = [
  { start: '10.0.0.0', end: '10.255.255.255' }, // Class A
  { start: '172.16.0.0', end: '172.31.255.255' }, // Class B
  { start: '192.168.0.0', end: '192.168.255.255' }, // Class C
];

/**
 * Link-local and loopback addresses
 */
const LOCAL_ADDRESSES = [
  '127.0.0.1', // IPv4 loopback
  '::1', // IPv6 loopback
  'localhost', // Hostname
];

/**
 * Converts IP address to numeric value for range comparison
 */
function ipToNumber(ip: string): number {
  const parts = ip.split('.');
  return (
    (parseInt(parts[0]) << 24) +
    (parseInt(parts[1]) << 16) +
    (parseInt(parts[2]) << 8) +
    parseInt(parts[3])
  );
}

/**
 * Checks if an IP address is in a private range
 */
function isPrivateIP(ip: string): boolean {
  const ipNum = ipToNumber(ip);

  return PRIVATE_IP_RANGES.some(range => {
    const startNum = ipToNumber(range.start);
    const endNum = ipToNumber(range.end);
    return ipNum >= startNum && ipNum <= endNum;
  });
}

/**
 * Checks if a hostname or IP is a local address
 */
function isLocalAddress(hostname: string): boolean {
  return LOCAL_ADDRESSES.includes(hostname.toLowerCase());
}

/**
 * Validates URL and checks security restrictions
 */
export function validateURL(
  urlString: string,
  options: {
    blockPrivateAddr?: boolean;
    allowLocalhost?: boolean;
  } = {}
): { isValid: boolean; error?: string; url?: URL } {
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

    // Check for localhost/local addresses
    if (isLocalAddress(url.hostname)) {
      if (!options.allowLocalhost) {
        return {
          isValid: false,
          error:
            'Localhost/local addresses are not allowed. Set ALLOW_LOCALHOST=true to enable.',
        };
      }
    }

    // Check for private IP addresses
    if (options.blockPrivateAddr && isPrivateIP(url.hostname)) {
      return {
        isValid: false,
        error:
          'Private IP addresses are not allowed. Set BLOCK_PRIVATE_ADDR=false to enable.',
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
 * Validates URL for navigation with current environment settings
 */
export function validateNavigationURL(
  urlString: string,
  env: {
    BLOCK_PRIVATE_ADDR: boolean;
    ALLOW_LOCALHOST: boolean;
  }
): { isValid: boolean; error?: string; url?: URL } {
  return validateURL(urlString, {
    blockPrivateAddr: env.BLOCK_PRIVATE_ADDR,
    allowLocalhost: env.ALLOW_LOCALHOST,
  });
}
