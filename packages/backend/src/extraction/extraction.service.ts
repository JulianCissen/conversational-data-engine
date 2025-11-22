import { Injectable } from '@nestjs/common';
import { AiService } from '../ai/ai.service';
import { PromptService } from '../config/prompt.service';
import { FieldDefinition, JsonSchema } from '../blueprint/interfaces/blueprint.interface';

@Injectable()
export class ExtractionService {
  constructor(
    private readonly aiService: AiService,
    private readonly promptService: PromptService,
  ) {}

  /**
   * Extracts structured data from unstructured user text based on the provided field definitions.
   * 
   * @param fields - Array of field definitions from the blueprint
   * @param userMessage - Unstructured text from the user
   * @returns Promise resolving to extracted data as a JSON object
   */
  async extractData(
    fields: FieldDefinition[],
    userMessage: string,
  ): Promise<Record<string, any>> {
    // Construct the JSON Schema
    const jsonSchema = this.buildJsonSchema(fields);

    // Get system prompt from database
    const systemPrompt = this.promptService.getPrompt('extraction.system');

    try {
      // Call the AI with structured output
      const structuredModel = this.aiService.chatModel.withStructuredOutput(jsonSchema);
      const result = await structuredModel.invoke([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ]);

      return result as Record<string, any>;
    } catch (error) {
      // If LLM refuses or fails, return empty object
      console.error('Extraction failed:', error);
      return {};
    }
  }

  /**
   * Builds a JSON Schema object from field definitions.
   * Enhances the schema with field context for better LLM understanding.
   * 
   * @param fields - Array of field definitions
   * @returns JSON Schema object
   */
  private buildJsonSchema(fields: FieldDefinition[]): JsonSchema {
    const jsonSchema: JsonSchema = {
      type: 'object',
      properties: {},
      required: [], // Allow partial extraction
      additionalProperties: false,
    };

    for (const field of fields) {
      // Start with the field's validation schema
      const propertySchema = { ...field.validation };

      // Enhance with context: inject questionTemplate or aiContext into description
      const contextParts: string[] = [];
      
      if (field.questionTemplate) {
        contextParts.push(`Question: ${field.questionTemplate}`);
      }
      
      if (field.aiContext) {
        contextParts.push(`Context: ${field.aiContext}`);
      }

      if (contextParts.length > 0) {
        // Prepend our context to any existing description
        const existingDescription = propertySchema.description || '';
        const enhancedDescription = contextParts.join(' | ') + 
          (existingDescription ? ` | ${existingDescription}` : '');
        propertySchema.description = enhancedDescription;
      }

      jsonSchema.properties[field.id] = propertySchema;
    }

    return jsonSchema;
  }
}
