import { Logger } from '@nestjs/common';
import {
  JsonSchema,
  LanguageConfig,
} from '../blueprint/interfaces/blueprint.interface';
import { PromptService } from '../../core/prompt/prompt.service';
import { TemplateService } from '../../core/template/template.service';
import { PROMPT_KEYS } from '../../core/prompt/prompt.constants';

/**
 * Represents a JSON schema property definition for structured outputs
 */
export interface SchemaFieldDefinition {
  type: string;
  description: string;
  enum?: string[];
  [key: string]: any;
}

/**
 * Get language detection schema field
 */
function getLanguageDetectionField(): SchemaFieldDefinition {
  return {
    type: 'string',
    description: `The ISO language code of the language the user is speaking (e.g., 'en', 'nl', 'de', 'fr')`,
  };
}

/**
 * Get language violation detection field for strict mode
 */
function getLanguageViolationField(
  defaultLanguage: string,
): SchemaFieldDefinition {
  return {
    type: 'boolean',
    description: `True if the user is NOT speaking ${defaultLanguage}. Ignore short responses like 'yes', 'no', 'ok'.`,
  };
}

/**
 * Get language violation message field for strict mode
 */
function getLanguageViolationMessageField(
  defaultLanguage: string,
): SchemaFieldDefinition {
  return {
    type: 'string',
    description: `If isLanguageViolation is true, provide a polite message in ${defaultLanguage} asking the user to communicate in ${defaultLanguage} only.`,
  };
}

/**
 * Builder for constructing system messages and JSON schemas with optional language enforcement.
 * Centralizes the logic for augmenting prompts and schemas based on blueprint configuration.
 */
export class SystemMessageBuilder {
  private readonly logger = new Logger(SystemMessageBuilder.name);
  private baseSystemMessageTemplate: string = '';
  private augmentationTemplates: Array<{
    template: string;
    context?: Record<string, any>;
  }> = [];
  private jsonSchema: JsonSchema;
  private context: Record<string, any> = {};

  public constructor(
    baseSystemMessage: string,
    private readonly promptService: PromptService,
    private readonly templateService: TemplateService,
  ) {
    this.baseSystemMessageTemplate = baseSystemMessage;
    // Initialize with empty schema structure
    this.jsonSchema = {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    };
  }

  /**
   * Set context variables for template interpolation.
   * These variables will be used when rendering prompt templates.
   *
   * @param context - Context variables for template interpolation
   * @returns this for chaining
   */
  public withContext(context: Record<string, any>): this {
    this.context = { ...this.context, ...context };
    return this;
  }

  /**
   * Apply language configuration to the system message and schema.
   * In strict mode, adds language enforcement instructions.
   * Adds language detection fields to the schema.
   *
   * @param languageConfig - Language configuration from the blueprint
   * @returns this for chaining
   */
  public withLanguageConfig(languageConfig: LanguageConfig | undefined): this {
    if (!languageConfig) {
      return this;
    }

    if (languageConfig.mode === 'strict') {
      // Store the template key and context for later rendering
      const template = this.promptService.getPrompt(
        PROMPT_KEYS.LANGUAGE_STRICT_AUGMENTATION,
      );
      this.augmentationTemplates.push({
        template,
        context: { defaultLanguage: languageConfig.defaultLanguage },
      });
    }

    // Add language fields to schema
    this.addLanguageFieldsToSchema(languageConfig);

    return this;
  }

  /**
   * Add schema properties to the JSON schema.
   * Merges the provided properties and required fields with existing ones.
   *
   * @param properties - Schema properties to add
   * @param required - Optional array of required property names
   * @returns this for chaining
   */
  public withSchemaProperties(
    properties: Record<string, SchemaFieldDefinition>,
    required?: string[],
  ): this {
    // Merge properties
    Object.assign(
      this.jsonSchema.properties as Record<string, SchemaFieldDefinition>,
      properties,
    );

    // Merge required fields if provided
    if (required && Array.isArray(required)) {
      const existingRequired = Array.isArray(this.jsonSchema.required)
        ? (this.jsonSchema.required as string[])
        : [];
      this.jsonSchema.required = [...existingRequired, ...required];
    }

    return this;
  }

  /**
   * Add language detection and enforcement fields to the JSON schema properties.
   */
  private addLanguageFieldsToSchema(languageConfig: LanguageConfig): void {
    // Add language detection field
    (
      this.jsonSchema.properties as Record<string, SchemaFieldDefinition>
    ).userMessageLanguage = getLanguageDetectionField();

    // Add violation fields for strict mode
    if (languageConfig.mode === 'strict') {
      (
        this.jsonSchema.properties as Record<string, SchemaFieldDefinition>
      ).isLanguageViolation = getLanguageViolationField(
        languageConfig.defaultLanguage,
      );
      (
        this.jsonSchema.properties as Record<string, SchemaFieldDefinition>
      ).languageViolationMessage = getLanguageViolationMessageField(
        languageConfig.defaultLanguage,
      );
    }
  }

  /**
   * Build and return the final system message with all augmentations.
   * All templates (base message and augmentations) are rendered with the accumulated context.
   *
   * @returns The constructed system message
   */
  public buildSystemMessage(): string {
    // Render base message with context
    const renderedBase = this.templateService.render(
      this.baseSystemMessageTemplate,
      this.context,
    );

    if (this.augmentationTemplates.length === 0) {
      return renderedBase;
    }

    // Render each augmentation with its specific context merged with global context
    const renderedAugmentations = this.augmentationTemplates.map((aug) => {
      const mergedContext = { ...this.context, ...aug.context };
      return this.templateService.render(aug.template, mergedContext);
    });

    return renderedBase + '\n\n' + renderedAugmentations.join('\n\n');
  }

  /**
   * Get the constructed JSON schema.
   *
   * @returns The JSON schema with all modifications applied
   */
  public getSchema(): JsonSchema {
    return this.jsonSchema;
  }

  /**
   * Check if system message has been augmented.
   *
   * @returns true if augmentations exist
   */
  public hasAugmentation(): boolean {
    return this.augmentationTemplates.length > 0;
  }
}
