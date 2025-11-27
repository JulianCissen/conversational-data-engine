import { Injectable, Logger } from '@nestjs/common';
import {
  FieldDefinition,
  JsonSchema,
  ServiceBlueprint,
} from '../blueprint/interfaces/blueprint.interface';
import { LlmMessage } from '../../core/llm/llm.types';
import { PromptExecutionService } from './prompt-execution.service';
import { PROMPT_KEYS } from '../../core/prompt/prompt.constants';

export type UserIntent = 'ANSWER' | 'QUESTION';
export type ServiceSelectionIntent =
  | 'LIST_SERVICES'
  | 'UNCLEAR'
  | (string & {});

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
   * @param languageConfig - Optional language configuration for enforcement
   * @param currentLanguage - Optional current conversation language
   * @param history - Optional conversation history to include
   * @returns Promise resolving to extracted data with optional language metadata
   */
  async extractData(
    fields: FieldDefinition[],
    userMessage: string,
    languageConfig?: { mode: 'adaptive' | 'strict'; defaultLanguage: string },
    currentLanguage?: string | null,
    history: LlmMessage[] = [],
  ): Promise<{
    data: Record<string, any>;
    userMessageLanguage?: string;
    isLanguageViolation?: boolean;
    languageViolationMessage?: string;
  }> {
    const jsonSchema = this.buildJsonSchema(fields, languageConfig);

    let result: Record<string, any>;

    if (languageConfig?.mode === 'strict') {
      const augmentation = `CRITICAL LANGUAGE REQUIREMENT: This conversation MUST be conducted in ${languageConfig.defaultLanguage} only. The user is required to communicate in ${languageConfig.defaultLanguage}. If they speak another language, you must detect this violation.`;
      result =
        await this.promptExecutionService.executeStructuredExtractionWithAugmentedSystem(
          PROMPT_KEYS.INTERPRETER_SYSTEM,
          augmentation,
          userMessage,
          jsonSchema,
          history,
        );
    } else {
      result = await this.promptExecutionService.executeStructuredExtraction(
        PROMPT_KEYS.INTERPRETER_SYSTEM,
        userMessage,
        jsonSchema,
        history,
      );
    }

    this.logger.debug(
      `[extractData] LLM extraction result: ${JSON.stringify(result)}`,
    );

    // If language enforcement is enabled, check for violations
    if (
      languageConfig?.mode === 'strict' &&
      result.isLanguageViolation === true
    ) {
      return {
        data: {},
        userMessageLanguage: result.userMessageLanguage as string | undefined,
        isLanguageViolation: true,
        languageViolationMessage: result.languageViolationMessage as
          | string
          | undefined,
      };
    }

    // Return extracted data and language detection for adaptive mode
    return {
      data: (result.data as Record<string, any>) || result,
      userMessageLanguage: result.userMessageLanguage as string | undefined,
      isLanguageViolation: false,
    };
  }

  /**
   * Classify the user's intent based on their message and the current field.
   * Determines if the user is trying to answer the question or asking for clarification.
   * @param userText The user's message
   * @param currentField The current field being collected
   * @param languageConfig Optional language configuration for strict enforcement
   * @param history Optional conversation history to include
   * @returns IntentClassification object with intent, reason, and optional language violation info
   */
  async classifyIntent(
    userText: string,
    currentField: FieldDefinition,
    languageConfig?: { mode: 'adaptive' | 'strict'; defaultLanguage: string },
    history: LlmMessage[] = [],
  ): Promise<
    IntentClassification & {
      isLanguageViolation?: boolean;
      languageViolationMessage?: string;
    }
  > {
    const schema: JsonSchema = {
      type: 'object',
      properties: {
        intent: {
          type: 'string',
          enum: ['ANSWER', 'QUESTION'],
          description:
            'Whether the user is providing an answer or asking a clarifying question',
        },
        reason: {
          type: 'string',
          description:
            'Brief explanation of why the message was classified as such',
        },
      },
      required: ['intent', 'reason'],
      additionalProperties: false,
    };

    // Add language violation detection for strict mode
    if (languageConfig?.mode === 'strict') {
      (schema.properties as Record<string, any>).userMessageLanguage = {
        type: 'string',
        description: `The ISO language code of the language the user is speaking (e.g., 'en', 'nl', 'de', 'fr')`,
      };
      (schema.properties as Record<string, any>).isLanguageViolation = {
        type: 'boolean',
        description: `True if the user is NOT speaking ${languageConfig.defaultLanguage}. Ignore short responses like 'yes', 'no', 'ok'.`,
      };
      (schema.properties as Record<string, any>).languageViolationMessage = {
        type: 'string',
        description: `If isLanguageViolation is true, provide a polite message in ${languageConfig.defaultLanguage} asking the user to communicate in ${languageConfig.defaultLanguage} only.`,
      };
    }

    let result: any;

    if (languageConfig?.mode === 'strict') {
      const augmentation = `CRITICAL LANGUAGE REQUIREMENT: This conversation MUST be conducted in ${languageConfig.defaultLanguage} only. The user is required to communicate in ${languageConfig.defaultLanguage} for all messages, including questions. If they speak another language, you must detect this violation.`;
      result =
        await this.promptExecutionService.executeStructuredChatWithAugmentedSystem(
          PROMPT_KEYS.INTENT_CLASSIFICATION_SYSTEM,
          augmentation,
          PROMPT_KEYS.INTENT_CLASSIFICATION_USER,
          {
            questionTemplate: currentField.questionTemplate,
            aiContext: currentField.aiContext,
            userText: userText,
          },
          schema,
          history,
        );
    } else {
      result = await this.promptExecutionService.executeStructuredChat(
        PROMPT_KEYS.INTENT_CLASSIFICATION_SYSTEM,
        PROMPT_KEYS.INTENT_CLASSIFICATION_USER,
        {
          questionTemplate: currentField.questionTemplate,
          aiContext: currentField.aiContext,
          userText: userText,
        },
        schema,
        history,
      );
    }

    // Type guard for result
    const typedResult = result as {
      intent?: string;
      reason?: string;
      isLanguageViolation?: boolean;
      languageViolationMessage?: string;
    };

    const classification: IntentClassification & {
      isLanguageViolation?: boolean;
      languageViolationMessage?: string;
    } = {
      intent: this.validateIntent(typedResult.intent || 'ANSWER'),
      reason: typedResult.reason || 'No reason provided',
    };

    // Add language violation info if present
    if (typedResult.isLanguageViolation) {
      classification.isLanguageViolation =
        typedResult.isLanguageViolation as boolean;
      classification.languageViolationMessage =
        typedResult.languageViolationMessage;
    }

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
   * @param history Optional conversation history to include
   * @returns The blueprint ID if matched, 'LIST_SERVICES' if asking for a list, 'UNCLEAR' if uncertain
   */
  async classifyServiceSelection(
    userText: string,
    services: ServiceBlueprint[],
    history: LlmMessage[] = [],
  ): Promise<ServiceSelectionIntent> {
    const serviceList = this.formatServiceListForPrompt(services);

    const response =
      await this.promptExecutionService.executeChatWithSystemTemplate(
        PROMPT_KEYS.SERVICE_SELECTION_SYSTEM,
        { serviceList },
        PROMPT_KEYS.SERVICE_SELECTION_USER,
        { userText },
        history,
      );

    return this.validateServiceSelection(response.trim(), services);
  }

  /**
   * Builds a JSON Schema object from field definitions.
   * Enhances the schema with field context for better LLM understanding.
   *
   * @param fields - Array of field definitions
   * @param languageConfig - Optional language configuration to enable language detection
   * @returns JSON Schema object
   */
  private buildJsonSchema(
    fields: FieldDefinition[],
    languageConfig?: { mode: 'adaptive' | 'strict'; defaultLanguage: string },
  ): JsonSchema {
    const jsonSchema: JsonSchema = {
      type: 'object',
      properties: {},
      required: [], // Allow partial extraction
      additionalProperties: false,
    };

    // If language config is provided, wrap the data fields and add language detection
    if (languageConfig) {
      const dataProperties: Record<string, any> = {};

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
          const existingDescription =
            (propertySchema.description as string | undefined) || '';
          const enhancedDescription =
            contextParts.join(' | ') +
            (existingDescription ? ` | ${existingDescription}` : '');
          propertySchema.description = enhancedDescription;
        }

        dataProperties[field.id] = propertySchema;
      }

      (jsonSchema.properties as Record<string, any>).data = {
        type: 'object',
        properties: dataProperties,
        description: 'Extracted field data from user message',
      };

      (jsonSchema.properties as Record<string, any>).userMessageLanguage = {
        type: 'string',
        description: `The ISO language code of the language the user is speaking (e.g., 'en', 'nl', 'de', 'fr')`,
      };

      if (languageConfig.mode === 'strict') {
        (jsonSchema.properties as Record<string, any>).isLanguageViolation = {
          type: 'boolean',
          description: `True if the user is NOT speaking ${languageConfig.defaultLanguage}. Ignore short responses like 'yes', 'no', 'ok'.`,
        };

        (
          jsonSchema.properties as Record<string, any>
        ).languageViolationMessage = {
          type: 'string',
          description: `If isLanguageViolation is true, provide a polite message in ${languageConfig.defaultLanguage} asking the user to communicate in ${languageConfig.defaultLanguage} only.`,
        };
      }
    } else {
      // No language config - use original simple schema
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
          const existingDescription =
            (propertySchema.description as string | undefined) || '';
          const enhancedDescription =
            contextParts.join(' | ') +
            (existingDescription ? ` | ${existingDescription}` : '');
          propertySchema.description = enhancedDescription;
        }

        (jsonSchema.properties as Record<string, any>)[field.id] =
          propertySchema;
      }
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
