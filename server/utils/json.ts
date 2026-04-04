/**
 * Safely parse JSON with error handling
 * @param json - The JSON string to parse
 * @param fallback - The fallback value to return if parsing fails
 * @returns The parsed JSON object or the fallback value
 */
export function safeJsonParse<T = any>(json: string, fallback: T): T {
  try {
    return JSON.parse(json);
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('JSON parse error:', error);
    }
    return fallback;
  }
}

/**
 * Safely parse JSON and throw an AppError on failure
 * @param json - The JSON string to parse
 * @param errorMessage - Custom error message
 * @returns The parsed JSON object
 * @throws AppError if parsing fails
 */
export function parseJsonOrThrow<T = any>(json: string, errorMessage: string = 'Invalid JSON'): T {
  try {
    return JSON.parse(json);
  } catch (error) {
    throw new Error(`${errorMessage}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Safely stringify an object to JSON
 * @param obj - The object to stringify
 * @param fallback - The fallback string if stringification fails
 * @returns The JSON string or fallback value
 */
export function safeJsonStringify(obj: any, fallback: string = '{}'): string {
  try {
    return JSON.stringify(obj);
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('JSON stringify error:', error);
    }
    return fallback;
  }
}

/**
 * Parse JWT token without verification (for debugging only)
 * WARNING: This does not verify the token signature
 * @param token - The JWT token
 * @returns The decoded payload or null if parsing fails
 */
export function unsafeParseJwt(token: string): any | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const payload = parts[1];
    const decoded = Buffer.from(payload, 'base64').toString('utf-8');
    return JSON.parse(decoded);
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('JWT parse error:', error);
    }
    return null;
  }
}
