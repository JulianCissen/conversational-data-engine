import { Injectable } from '@nestjs/common';
import { LlmService } from '../../core/llm/llm.service';
import { PromptService } from '../../core/prompt/prompt.service';
import { TemplateService } from '../../core/template/template.service';
import { FieldDefinition, JsonSchema, ServiceBlueprint } from '../blueprint/interfaces/blueprint.interface';

export type UserIntent = 'ANSWER' | 'QUESTION';
export type ServiceSelectionIntent = string | 'LIST_SERVICES' | 'UNCLEAR';

@Injectable()
export class InterpreterService {
  constructor(
    private readonly llmService: LlmService,
    private readonly promptService: PromptService,
    private readonly templateService: TemplateService,
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
    const systemPrompt = this.promptService.getPrompt('interpreter.system');

    try {
      // Call the AI with structured output
      const structuredModel = this.llmService.chatModel.withStructuredOutput(jsonSchema);
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
   * Classify the user's intent based on their message and the current field.
   * Determines if the user is trying to answer the question or asking for clarification.
   * @param userText The user's message
   * @param currentField The current field being collected
   * @returns 'ANSWER' if providing data, 'QUESTION' if asking for clarification
   */
  async classifyIntent(
    userText: string,
    currentField: FieldDefinition,
  ): Promise<UserIntent> {
    const systemPrompt = this.promptService.getPrompt('intent.classification.system');
    
    const userMessageTemplate = this.promptService.getPrompt('intent.classification.user');
    const userMessage = this.templateService.render(userMessageTemplate, {
      questionTemplate: currentField.questionTemplate,
      aiContext: currentField.aiContext,
      userText: userText,
    });

    const response = await this.llmService.chat(systemPrompt, userMessage);
    const intent = response.trim().toUpperCase();

    // Validate and return the intent
    if (intent === 'ANSWER' || intent === 'QUESTION') {
      return intent;
    }

    // Default to ANSWER if unclear (safer to attempt extraction)
    return 'ANSWER';
  }

  /**
   * Classify which service the user wants to select based on their message.
   * Uses LLM to match user intent to available services.
   * @param userText The user's message
   * @param services Array of available service blueprints
   * @returns The blueprint ID if matched, 'LIST_SERVICES' if asking for a list, 'UNCLEAR' if uncertain
   */
  async classifyServiceSelection(
    userText: string,
    services: ServiceBlueprint[],
  ): Promise<ServiceSelectionIntent> {
    // Build service list for the prompt
    const serviceList = services
      .map((s) => `- ${s.id}: ${s.name}`)
      .join('\n');

    const systemPromptTemplate = this.promptService.getPrompt('service.selection.system');
    const systemPrompt = this.templateService.render(systemPromptTemplate, {
      serviceList: serviceList,
    });

    const userMessageTemplate = this.promptService.getPrompt('service.selection.user');
    const userMessage = this.templateService.render(userMessageTemplate, {
      userText: userText,
    });

    const response = await this.llmService.chat(systemPrompt, userMessage);
    const intent = response.trim();

    // Validate response
    if (intent === 'LIST_SERVICES' || intent === 'UNCLEAR') {
      return intent;
    }

    // Check if the response is a valid service ID
    const matchedService = services.find((s) => s.id === intent);
    if (matchedService) {
      return matchedService.id;
    }

    // If we can't match, return UNCLEAR
    return 'UNCLEAR';
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
