import { Injectable, Logger } from '@nestjs/common';
import { FieldDefinition, JsonSchema, ServiceBlueprint } from '../blueprint/interfaces/blueprint.interface';
import { PromptExecutionService } from './prompt-execution.service';
import { PROMPT_KEYS } from '../../core/prompt/prompt.constants';

export type UserIntent = 'ANSWER' | 'QUESTION';
export type ServiceSelectionIntent = string | 'LIST_SERVICES' | 'UNCLEAR';

export interface IntentClassification {
  intent: UserIntent;
  reason: string;
}

@Injectable()
export class InterpreterService {
  private readonly logger = new Logger(InterpreterService.name);

  constructor(
    private readonly promptExecutionService: PromptExecutionService,
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
    const jsonSchema = this.buildJsonSchema(fields);
    
    const result = await this.promptExecutionService.executeStructuredExtraction(
      PROMPT_KEYS.INTERPRETER_SYSTEM,
      userMessage,
      jsonSchema,
    );
    
    this.logger.debug(`[extractData] LLM extraction result: ${JSON.stringify(result)}`);
    return result;
  }

  /**
   * Classify the user's intent based on their message and the current field.
   * Determines if the user is trying to answer the question or asking for clarification.
   * @param userText The user's message
   * @param currentField The current field being collected
   * @returns IntentClassification object with intent and reason
   */
  async classifyIntent(
    userText: string,
    currentField: FieldDefinition,
  ): Promise<IntentClassification> {
    const schema: JsonSchema = {
      type: 'object',
      properties: {
        intent: {
          type: 'string',
          enum: ['ANSWER', 'QUESTION'],
          description: 'Whether the user is providing an answer or asking a clarifying question',
        },
        reason: {
          type: 'string',
          description: 'Brief explanation of why the message was classified as such',
        },
      },
      required: ['intent', 'reason'],
      additionalProperties: false,
    };

    const result = await this.promptExecutionService.executeStructuredChat(
      PROMPT_KEYS.INTENT_CLASSIFICATION_SYSTEM,
      PROMPT_KEYS.INTENT_CLASSIFICATION_USER,
      {
        questionTemplate: currentField.questionTemplate,
        aiContext: currentField.aiContext,
        userText: userText,
      },
      schema,
    );

    const classification: IntentClassification = {
      intent: this.validateIntent(result.intent || 'ANSWER'),
      reason: result.reason || 'No reason provided',
    };

    // Log if the message is not classified as a valid answer
    if (classification.intent !== 'ANSWER') {
      this.logger.log(
        `Intent classified as ${classification.intent}: "${userText}" - Reason: ${classification.reason}`,
      );
    }

    return classification;
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
    const serviceList = this.formatServiceListForPrompt(services);

    const response = await this.promptExecutionService.executeChatWithSystemTemplate(
      PROMPT_KEYS.SERVICE_SELECTION_SYSTEM,
      { serviceList },
      PROMPT_KEYS.SERVICE_SELECTION_USER,
      { userText },
    );

    return this.validateServiceSelection(response.trim(), services);
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

  /**
   * Validate and return a user intent, defaulting to ANSWER if unclear.
   * @param intent The intent string from LLM
   * @returns Validated UserIntent
   */
  private validateIntent(intent: string | undefined): UserIntent {
    const normalized = intent?.trim().toUpperCase();
    if (normalized === 'ANSWER' || normalized === 'QUESTION') {
      return normalized;
    }
    // Default to ANSWER if unclear (safer to attempt extraction)
    return 'ANSWER';
  }

  /**
   * Format service list for inclusion in prompts.
   * @param services Array of service blueprints
   * @returns Formatted service list string
   */
  private formatServiceListForPrompt(services: ServiceBlueprint[]): string {
    return services.map((s) => `- ${s.id}: ${s.name}`).join('\n');
  }

  /**
   * Validate service selection response from LLM.
   * @param intent The intent string from LLM
   * @param services Available services for validation
   * @returns Validated service selection intent
   */
  private validateServiceSelection(
    intent: string,
    services: ServiceBlueprint[],
  ): ServiceSelectionIntent {
    // Check for special intents
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
}
