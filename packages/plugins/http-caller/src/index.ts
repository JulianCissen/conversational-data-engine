import {
  createPlugin,
  PluginContext,
  PluginResult,
} from '@conversational-data-engine/plugin-builder';
import axios, { AxiosRequestConfig, Method } from 'axios';

/**
 * Configuration interface for the HTTP Caller plugin.
 */
interface HttpCallerConfig {
  /**
   * The HTTP method to use (GET, POST, PUT, PATCH, DELETE).
   */
  method: Method;

  /**
   * The URL to call. Supports slot interpolation using {slot_name} syntax.
   * Example: "https://api.example.com/user/{user_id}"
   */
  url: string;

  /**
   * Optional headers to include in the request.
   */
  headers?: Record<string, string>;

  /**
   * Optional request body for POST/PUT/PATCH requests.
   * Supports slot interpolation.
   */
  body?: Record<string, any>;

  /**
   * Mapping of API response fields to conversation slot IDs.
   * Example: { "api_field_name": "conversation_slot_id" }
   */
  responseMapping: Record<string, string>;

  /**
   * Optional timeout in milliseconds (default: 5000).
   */
  timeout?: number;
}

/**
 * HTTP Caller Plugin
 * 
 * Makes HTTP requests to external APIs and maps responses to conversation slots.
 * Primary use case is in the onFieldValidated hook for data enrichment.
 * 
 * Example Configuration:
 * ```json
 * {
 *   "id": "user-lookup",
 *   "config": {
 *     "method": "GET",
 *     "url": "https://api.example.com/user/{user_id}",
 *     "headers": {
 *       "Authorization": "Bearer YOUR_TOKEN"
 *     },
 *     "responseMapping": {
 *       "name": "user_name",
 *       "email": "user_email",
 *       "city": "user_city"
 *     },
 *     "timeout": 5000
 *   }
 * }
 * ```
 */
export const HttpCallerPlugin = createPlugin({
  async onFieldValidated(context: PluginContext): Promise<PluginResult> {
    const config = context.config as HttpCallerConfig;

    // Validate required config
    if (!config.url || !config.method || !config.responseMapping) {
      throw new Error(
        'HttpCallerPlugin requires url, method, and responseMapping in config',
      );
    }

    try {
      // Interpolate URL with slot values
      const interpolatedUrl = interpolateString(config.url, context.data);

      // Prepare request configuration
      const requestConfig: AxiosRequestConfig = {
        method: config.method,
        url: interpolatedUrl,
        headers: config.headers || {},
        timeout: config.timeout || 5000,
      };

      // Add body for POST/PUT/PATCH requests
      if (
        config.body &&
        ['POST', 'PUT', 'PATCH'].includes(config.method.toUpperCase())
      ) {
        requestConfig.data = interpolateObject(config.body, context.data);
      }

      // Execute HTTP request
      const response = await axios(requestConfig);

      // Map response data to conversation slots
      const slotUpdates: Record<string, any> = {};
      for (const [apiField, slotId] of Object.entries(config.responseMapping)) {
        const value = getNestedValue(response.data, apiField);
        if (value !== undefined) {
          slotUpdates[slotId] = value;
        }
      }

      return {
        slotUpdates,
        metadata: {
          status: response.status,
          url: interpolatedUrl,
          method: config.method,
        },
      };
    } catch (error: any) {
      const errorMessage = error.response
        ? `HTTP ${error.response.status}: ${error.response.statusText}`
        : error.message;

      throw new Error(`HttpCallerPlugin failed: ${errorMessage}`);
    }
  },
});

/**
 * Interpolate a string with slot values.
 * Replaces {slot_name} with actual values from the data object.
 */
function interpolateString(
  template: string,
  data: Record<string, any>,
): string {
  return template.replace(/\{([^}]+)\}/g, (match, key) => {
    const value = data[key];
    return value !== undefined ? String(value) : match;
  });
}

/**
 * Interpolate an object with slot values.
 * Recursively replaces string values containing {slot_name} syntax.
 */
function interpolateObject(
  obj: Record<string, any>,
  data: Record<string, any>,
): Record<string, any> {
  const result: Record<string, any> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      result[key] = interpolateString(value, data);
    } else if (typeof value === 'object' && value !== null) {
      result[key] = interpolateObject(value, data);
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Get a nested value from an object using dot notation.
 * Example: getNestedValue({ user: { name: "John" } }, "user.name") => "John"
 */
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

export default HttpCallerPlugin;
