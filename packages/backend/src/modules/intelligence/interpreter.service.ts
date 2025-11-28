import { Injectable, Logger } from '@nestjs/common';
import {
  FieldDefinition,
  ServiceBlueprint,
} from '../blueprint/interfaces/blueprint.interface';
import { LlmMessage } from '../../core/llm/llm.types';
import { PromptExecutionService } from './prompt-execution.service';
import { PROMPT_KEYS } from '../../core/prompt/prompt.constants';
import { SystemMessageBuilder } from './system-message.builder';
import { PromptService } from '../../core/prompt/prompt.service';
import { TemplateService } from '../../core/template/template.service';
import { LanguageViolationException } from './intelligence.exceptions';

export type UserIntent = 'ANSWER' | 'QUESTION';
export type ServiceSelectionIntent =
  | 'LIST_SERVICES'
  | 'UNCLEAR'
  | (string & {});

export interface IntentClassification {
  intent: UserIntent;
  reason: string;
}

/**
 * JSON Schema definitions for structured LLM responses.
 * Implemented as functions to prevent accidental mutations.
 */
function getIntentClassificationSchema() {
  return {
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
  };
}

function getServiceSelectionSchemaBase() {
  return {
    reason: {
      type: 'string',
      description: 'Brief explanation of why this selection was made',
    },
  };
}

@Injectable()
export class InterpreterService {
  private readonly logger = new Logger(InterpreterService.name);

  constructor(
    private readonly promptExecutionService: PromptExecutionService,
    private readonly promptService: PromptService,
    private readonly templateService: TemplateService,
  ) {}

  /**
   * Extracts structured data from unstructured user text based on the provided field definitions.
   * The user message is expected to be the last message in the history array.
   *
   * @param fields - Array of field definitions from the blueprint
   * @param languageConfig - Optional language configuration for enforcement
   * @param history - Conversation history including the current user message as the last entry
   * @returns Promise resolving to extracted data with language metadata
   * @throws LanguageViolationException if strict mode is enabled and user violates language rules
   */
  public async extractData(
    fields: FieldDefinition[],
    languageConfig?: { mode: 'adaptive' | 'strict'; defaultLanguage: string },
    history: LlmMessage[] = [],
  ): Promise<{
    data: Record<string, any>;
    userMessageLanguage?: string;
  }> {
    const dataProperties = this.buildDataProperties(fields);

    const schemaProperties = {
      data: {
        type: 'object',
        properties: dataProperties,
        description: 'Extracted field data from user message',
      },
    };

    const result = await this.executeStructuredTask({
      systemPromptKey: PROMPT_KEYS.INTERPRETER_SYSTEM,
      schema: {
        properties: schemaProperties,
        required: ['data'],
      },
      history,
      languageConfig,
    });

    this.logger.debug(
      `[extractData] LLM extraction result: ${JSON.stringify(result)}`,
    );

    // Return extracted data and language detection
    return {
      data: (result.data as Record<string, any>) || {},
      userMessageLanguage: result.userMessageLanguage as string | undefined,
    };
  }

  /**
   * Classify the user's intent based on their message and the current field.
   * Determines if the user is trying to answer the question or asking for clarification.
   * The user message is expected to be the last message in the history array.
   * @param currentField The current field being collected
   * @param languageConfig Optional language configuration for strict enforcement
   * @param history Conversation history including the current user message as the last entry
   * @returns IntentClassification object with intent and reason
   * @throws LanguageViolationException if strict mode is enabled and user violates language rules
   */
  public async classifyIntent(
    currentField: FieldDefinition,
    languageConfig?: { mode: 'adaptive' | 'strict'; defaultLanguage: string },
    history: LlmMessage[] = [],
  ): Promise<IntentClassification> {
    const result = await this.executeStructuredTask({
      systemPromptKey: PROMPT_KEYS.INTENT_CLASSIFICATION,
      context: {
        questionTemplate: currentField.questionTemplate,
        aiContext: currentField.aiContext,
      },
      schema: {
        properties: getIntentClassificationSchema(),
        required: ['intent', 'reason'],
      },
      history,
      languageConfig,
    });

    // Type guard for result
    const typedResult = result as {
      intent?: string;
      reason?: string;
    };

    const classification: IntentClassification = {
      intent: this.validateIntent(typedResult.intent || 'ANSWER'),
      reason: typedResult.reason || 'No reason provided',
    };

    return classification;
  }

  /**
   * Classify which service the user wants to select based on their message.
   * Uses LLM to match user intent to available services.
   * The user message is expected to be the last message in the history array.
   * @param services Array of available service blueprints
   * @param history Conversation history including the current user message as the last entry
   * @returns The blueprint ID if matched, 'LIST_SERVICES' if asking for a list, 'UNCLEAR' if uncertain
   */
  public async classifyServiceSelection(
    services: ServiceBlueprint[],
    history: LlmMessage[] = [],
  ): Promise<ServiceSelectionIntent> {
    const serviceList = this.formatServiceListForPrompt(services);

    // Build schema for structured output with dynamic enum
    const properties = {
      selection: {
        type: 'string',
        description:
          'The service ID if matched, "LIST_SERVICES" if user wants to see all services, or "UNCLEAR" if uncertain',
        enum: [
          'LIST_SERVICES',
          'UNCLEAR',
          ...services.map((s) => s.id),
        ] as string[],
      },
      ...getServiceSelectionSchemaBase(),
    };

    const result = await this.executeStructuredTask({
      systemPromptKey: PROMPT_KEYS.SERVICE_SELECTION,
      context: {
        serviceList,
      },
      schema: {
        properties,
        required: ['selection', 'reason'],
      },
      history,
    });

    const typedResult = result as {
      selection?: string;
      reason?: string;
    };

    const selection = typedResult.selection || 'UNCLEAR';

    this.logger.debug(
      `[classifyServiceSelection] Selected: ${selection}, Reason: ${typedResult.reason}`,
    );

    return this.validateServiceSelection(selection, services);
  }

  /**
   * Builds schema properties from field definitions for data extraction.
   * Enhances each field's validation schema with context from questionTemplate and aiContext.
   * @param fields Array of field definitions from the blueprint
   * @returns Record of schema properties keyed by field ID
   */
  private buildDataProperties(fields: FieldDefinition[]): Record<string, any> {
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
          (propertySchema.description as string) || '';
        const enhancedDescription =
          contextParts.join(' | ') +
          (existingDescription ? ` | ${existingDescription}` : '');
        propertySchema.description = enhancedDescription;
      }

      dataProperties[field.id] = propertySchema;
    }

    return dataProperties;
  }

  /**
   * Generic method to execute a structured LLM task.
   * Handles building the system message, executing the chat, and checking for language violations.
   * @param params - Task execution parameters
   * @param params.systemPromptKey - The prompt key for the system message
   * @param params.context - Optional context variables for template interpolation
   * @param params.schema - Schema definition for structured output
   * @param params.schema.properties - JSON schema properties for structured output
   * @param params.schema.required - Array of required property names
   * @param params.history - Conversation history including the current user message
   * @param params.languageConfig - Optional language configuration
   * @returns Promise resolving to the structured result
   * @throws LanguageViolationException if strict mode is enabled and language violation detected
   */
  private async executeStructuredTask({
    systemPromptKey,
    context,
    schema,
    history,
    languageConfig,
  }: {
    systemPromptKey: string;
    context?: Record<string, any>;
    schema: {
      properties: Record<string, any>;
      required: string[];
    };
    history: LlmMessage[];
    languageConfig?: { mode: 'adaptive' | 'strict'; defaultLanguage: string };
  }): Promise<Record<string, any>> {
    const baseSystemPrompt = this.promptService.getPrompt(systemPromptKey);

    const builder = new SystemMessageBuilder(baseSystemPrompt);

    // Add context if provided
    if (context) {
      builder.withContext(context);
    }

    builder
      .withSchemaProperties(schema.properties, schema.required)
      .withLanguageConfig(languageConfig);

    const result = await this.promptExecutionService.executeStructuredChat(
      builder,
      history,
    );

    // Check for language violations in strict mode
    if (
      languageConfig?.mode === 'strict' &&
      result.isLanguageViolation === true
    ) {
      const violationMessage =
        (result.languageViolationMessage as string) ||
        `Please communicate in ${languageConfig.defaultLanguage} only.`;

      throw new LanguageViolationException(
        violationMessage,
        result.userMessageLanguage as string | undefined,
        languageConfig.defaultLanguage,
      );
    }

    return result;
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
