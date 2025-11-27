import { Injectable, Logger } from '@nestjs/common';
import { jsonSchemaToZod } from 'json-schema-to-zod';
import { z } from 'zod';
import {
  FieldDefinition,
  JsonSchema,
} from '../../modules/blueprint/interfaces/blueprint.interface';

/**
 * Service for validating field values against JSON Schema definitions.
 * Converts JSON Schema to Zod schemas for runtime validation.
 */
@Injectable()
export class ValidationService {
  private readonly logger = new Logger(ValidationService.name);
  private readonly schemaCache = new Map<string, z.ZodTypeAny>();

  /**
   * Validate a field value against its JSON Schema definition using Zod.
   * @param value The value to validate
   * @param field The field definition containing validation schema
   * @returns true if valid, false otherwise
   */
  validateValue(value: unknown, field: FieldDefinition): boolean {
    try {
      const zodSchema = this.getOrCreateZodSchema(field.validation);
      zodSchema.parse(value);
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        this.logger.debug(
          `[validateValue] '${field.id}' failed: ${error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
        );
      } else {
        this.logger.error(
          `[validateValue] Unexpected error for '${field.id}':`,
          error,
        );
      }
      return false;
    }
  }

  /**
   * Get or create a Zod schema from JSON Schema, with caching.
   * Cache key is based on the JSON Schema content hash to handle cases where
   * multiple services use the same field ID with different validation rules.
   * @param jsonSchema The JSON Schema definition
   * @returns Zod schema instance
   */
  private getOrCreateZodSchema(jsonSchema: JsonSchema): z.ZodTypeAny {
    // Create a cache key based on the schema content
    const cacheKey = JSON.stringify(jsonSchema);

    // Check cache first
    if (this.schemaCache.has(cacheKey)) {
      return this.schemaCache.get(cacheKey)!;
    }

    try {
      // Convert JSON Schema to Zod schema string
      const zodSchemaString = jsonSchemaToZod(jsonSchema, {
        module: 'none', // Don't add import statements
        name: undefined, // Don't create a named export
      });

      // Create a safe evaluation context with only z available
      // eslint-disable-next-line @typescript-eslint/no-implied-eval
      const createZodSchema = new Function(
        'z',
        `return ${zodSchemaString}`,
      ) as (zodLib: typeof z) => z.ZodTypeAny;
      const zodSchema: z.ZodTypeAny = createZodSchema(z);

      // Cache for future use
      this.schemaCache.set(cacheKey, zodSchema);

      return zodSchema;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to create Zod schema: ${message}`);
      // Fallback to a permissive schema that accepts anything
      return z.any();
    }
  }

  /**
   * Clear the schema cache (useful for testing or dynamic schema updates).
   */
  clearCache(): void {
    this.schemaCache.clear();
  }
}
