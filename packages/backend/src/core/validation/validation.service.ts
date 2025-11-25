import { Injectable, Logger } from '@nestjs/common';
import { jsonSchemaToZod } from 'json-schema-to-zod';
import { z } from 'zod';
import { FieldDefinition, JsonSchema } from '../../modules/blueprint/interfaces/blueprint.interface';

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
  validateValue(value: any, field: FieldDefinition): boolean {
    try {
      const zodSchema = this.getOrCreateZodSchema(field.id, field.validation);
      zodSchema.parse(value);
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        this.logger.debug(
          `[validateValue] '${field.id}' failed: ${error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
        );
      } else {
        this.logger.error(`[validateValue] Unexpected error for '${field.id}':`, error);
      }
      return false;
    }
  }

  /**
   * Get or create a Zod schema from JSON Schema, with caching.
   * @param fieldId The field ID for cache key
   * @param jsonSchema The JSON Schema definition
   * @returns Zod schema instance
   */
  private getOrCreateZodSchema(fieldId: string, jsonSchema: JsonSchema): z.ZodTypeAny {
    // Check cache first
    if (this.schemaCache.has(fieldId)) {
      return this.schemaCache.get(fieldId)!;
    }

    try {
      // Convert JSON Schema to Zod schema string
      const zodSchemaString = jsonSchemaToZod(jsonSchema, {
        module: 'none', // Don't add import statements
        name: undefined, // Don't create a named export
      });

      // Create a safe evaluation context with only z available
      const createZodSchema = new Function('z', `return ${zodSchemaString}`);
      const zodSchema = createZodSchema(z);

      // Cache for future use
      this.schemaCache.set(fieldId, zodSchema);

      return zodSchema;
    } catch (error) {
      this.logger.error(
        `Failed to create Zod schema for field '${fieldId}': ${error.message}`,
      );
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
