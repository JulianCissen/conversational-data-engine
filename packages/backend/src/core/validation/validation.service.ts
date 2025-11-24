import { Injectable } from '@nestjs/common';
import { jsonSchemaToZod } from 'json-schema-to-zod';
import { z } from 'zod';
import { FieldDefinition, JsonSchema } from '../../modules/blueprint/interfaces/blueprint.interface';

/**
 * Service for validating field values against JSON Schema definitions.
 * Converts JSON Schema to Zod schemas for runtime validation.
 */
@Injectable()
export class ValidationService {
  private readonly schemaCache = new Map<string, z.ZodTypeAny>();

  /**
   * Validate a field value against its JSON Schema definition.
   * @param value The value to validate
   * @param field The field definition containing validation schema
   * @returns true if valid, false otherwise
   */
  validateValue(value: any, field: FieldDefinition): boolean {
    // Basic null/undefined check
    if (value === null || value === undefined || value === '') {
      return false;
    }

    // Type-specific validation
    if (!this.validateBasicType(value, field.type)) {
      return false;
    }

    // JSON Schema validation if defined
    if (field.validation && Object.keys(field.validation).length > 0) {
      return this.validateAgainstSchema(value, field);
    }

    return true;
  }

  /**
   * Validate basic type compatibility.
   * @param value The value to check
   * @param expectedType The expected field type
   * @returns true if type matches, false otherwise
   */
  private validateBasicType(value: any, expectedType: string): boolean {
    switch (expectedType) {
      case 'number':
        return typeof value === 'number' && !isNaN(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'string':
        return typeof value === 'string';
      case 'date':
        // Date can be string or Date object
        return typeof value === 'string' || value instanceof Date;
      default:
        return true;
    }
  }

  /**
   * Validate value against JSON Schema using Zod.
   * @param value The value to validate
   * @param field The field definition with validation schema
   * @returns true if valid, false otherwise
   */
  private validateAgainstSchema(value: any, field: FieldDefinition): boolean {
    try {
      const zodSchema = this.getOrCreateZodSchema(field.id, field.validation);
      zodSchema.parse(value);
      return true;
    } catch (error) {
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

    // Convert JSON Schema to Zod
    const zodSchemaString = jsonSchemaToZod(jsonSchema);
    
    // Evaluate the generated Zod schema string
    // Note: This uses eval which is safe here as we control the input
    const zodSchema = eval(zodSchemaString);
    
    // Cache for future use
    this.schemaCache.set(fieldId, zodSchema);
    
    return zodSchema;
  }

  /**
   * Clear the schema cache (useful for testing or dynamic schema updates).
   */
  clearCache(): void {
    this.schemaCache.clear();
  }
}
