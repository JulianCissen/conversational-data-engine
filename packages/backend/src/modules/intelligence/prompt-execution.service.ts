import { Injectable, Logger } from '@nestjs/common';
import { LlmService } from '../../core/llm/llm.service';
import { LlmMessage } from '../../core/llm/llm.types';
import { PromptService } from '../../core/prompt/prompt.service';
import { TemplateService } from '../../core/template/template.service';
import { JsonSchema } from '../blueprint/interfaces/blueprint.interface';

/**
 * Service for executing prompts with template rendering and LLM invocation.
 * Abstracts the common pattern of: get prompt -> render template -> call LLM.
 */
@Injectable()
export class PromptExecutionService {
  private readonly logger = new Logger(PromptExecutionService.name);
  constructor(
    private readonly llmService: LlmService,
    private readonly promptService: PromptService,
    private readonly templateService: TemplateService,
  ) {}

  /**
   * Execute a chat completion with system and user prompts.
   * @param systemPromptKey The key for the system prompt
   * @param userPromptKey The key for the user prompt
   * @param variables Variables to render in the user prompt template
   * @param history Optional conversation history to include
   * @returns The LLM response as a string
   */
  async executeChat(
    systemPromptKey: string,
    userPromptKey: string,
    variables: Record<string, any>,
    history: LlmMessage[] = [],
  ): Promise<string> {
    const systemPrompt = this.promptService.getPrompt(systemPromptKey);
    const userPromptTemplate = this.promptService.getPrompt(userPromptKey);
    const userMessage = this.templateService.render(userPromptTemplate, variables);

    const messages: LlmMessage[] = [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: userMessage },
    ];

    return await this.llmService.chat(messages);
  }

  /**
   * Execute a chat completion with an augmented system prompt and user prompt.
   * @param systemPromptKey The key for the base system prompt
   * @param systemPromptAugmentation Additional text to append to the system prompt
   * @param userPromptKey The key for the user prompt
   * @param variables Variables to render in the user prompt template
   * @param history Optional conversation history to include
   * @returns The LLM response as a string
   */
  async executeChatWithAugmentedSystem(
    systemPromptKey: string,
    systemPromptAugmentation: string,
    userPromptKey: string,
    variables: Record<string, any>,
    history: LlmMessage[] = [],
  ): Promise<string> {
    const baseSystemPrompt = this.promptService.getPrompt(systemPromptKey);
    const systemPrompt = baseSystemPrompt + '\n\n' + systemPromptAugmentation;
    const userPromptTemplate = this.promptService.getPrompt(userPromptKey);
    const userMessage = this.templateService.render(userPromptTemplate, variables);

    const messages: LlmMessage[] = [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: userMessage },
    ];

    return await this.llmService.chat(messages);
  }

  /**
   * Execute a chat completion with a system prompt that also requires template rendering.
   * @param systemPromptKey The key for the system prompt template
   * @param systemVariables Variables to render in the system prompt template
   * @param userPromptKey The key for the user prompt
   * @param userVariables Variables to render in the user prompt template
   * @param history Optional conversation history to include
   * @returns The LLM response as a string
   */
  async executeChatWithSystemTemplate(
    systemPromptKey: string,
    systemVariables: Record<string, any>,
    userPromptKey: string,
    userVariables: Record<string, any>,
    history: LlmMessage[] = [],
  ): Promise<string> {
    const systemPromptTemplate = this.promptService.getPrompt(systemPromptKey);
    const systemPrompt = this.templateService.render(systemPromptTemplate, systemVariables);
    
    const userPromptTemplate = this.promptService.getPrompt(userPromptKey);
    const userMessage = this.templateService.render(userPromptTemplate, userVariables);

    const messages: LlmMessage[] = [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: userMessage },
    ];

    return await this.llmService.chat(messages);
  }

  /**
   * Execute structured data extraction with a JSON schema.
   * @param systemPromptKey The key for the system prompt
   * @param userMessage The user's raw message
   * @param jsonSchema The JSON schema for structured output
   * @param history Optional conversation history to include
   * @returns The extracted data as a JSON object
   */
  async executeStructuredExtraction(
    systemPromptKey: string,
    userMessage: string,
    jsonSchema: JsonSchema,
    history: LlmMessage[] = [],
  ): Promise<Record<string, any>> {
    const systemPrompt = this.promptService.getPrompt(systemPromptKey);

    const messages: LlmMessage[] = [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: userMessage },
    ];

    try {
      const result = await this.llmService.chatStructured(jsonSchema, messages);

      this.logger.debug(`[executeStructuredExtraction] LLM output: ${JSON.stringify(result)}`);
      return result as Record<string, any>;
    } catch (error) {
      this.logger.error(`[executeStructuredExtraction] Failed:`, error);
      return {};
    }
  }

  /**
   * Execute structured data extraction with augmented system prompt.
   * @param systemPromptKey The key for the base system prompt
   * @param systemPromptAugmentation Additional text to append to the system prompt
   * @param userMessage The user's raw message
   * @param jsonSchema The JSON schema for structured output
   * @param history Optional conversation history to include
   * @returns The extracted data as a JSON object
   */
  async executeStructuredExtractionWithAugmentedSystem(
    systemPromptKey: string,
    systemPromptAugmentation: string,
    userMessage: string,
    jsonSchema: JsonSchema,
    history: LlmMessage[] = [],
  ): Promise<Record<string, any>> {
    const baseSystemPrompt = this.promptService.getPrompt(systemPromptKey);
    const systemPrompt = baseSystemPrompt + '\n\n' + systemPromptAugmentation;

    const messages: LlmMessage[] = [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: userMessage },
    ];

    try {
      const result = await this.llmService.chatStructured(jsonSchema, messages);

      this.logger.debug(`[executeStructuredExtractionWithAugmentedSystem] LLM output: ${JSON.stringify(result)}`);
      return result as Record<string, any>;
    } catch (error) {
      this.logger.error(`[executeStructuredExtractionWithAugmentedSystem] Failed:`, error);
      return {};
    }
  }

  /**
   * Execute a structured chat completion with template rendering for both prompts.
   * @param systemPromptKey The key for the system prompt
   * @param userPromptKey The key for the user prompt
   * @param variables Variables to render in the user prompt template
   * @param jsonSchema The JSON schema for structured output
   * @param history Optional conversation history to include
   * @returns The extracted structured data as a JSON object
   */
  async executeStructuredChat(
    systemPromptKey: string,
    userPromptKey: string,
    variables: Record<string, any>,
    jsonSchema: JsonSchema,
    history: LlmMessage[] = [],
  ): Promise<Record<string, any>> {
    const systemPrompt = this.promptService.getPrompt(systemPromptKey);
    const userPromptTemplate = this.promptService.getPrompt(userPromptKey);
    const userMessage = this.templateService.render(userPromptTemplate, variables);

    const messages: LlmMessage[] = [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: userMessage },
    ];

    try {
      const result = await this.llmService.chatStructured(jsonSchema, messages);

      return result as Record<string, any>;
    } catch (error) {
      this.logger.error('Structured chat failed:', error);
      return {};
    }
  }

  /**
   * Execute a structured chat completion with augmented system prompt.
   * @param systemPromptKey The key for the base system prompt
   * @param systemPromptAugmentation Additional text to append to the system prompt
   * @param userPromptKey The key for the user prompt
   * @param variables Variables to render in the user prompt template
   * @param jsonSchema The JSON schema for structured output
   * @param history Optional conversation history to include
   * @returns The extracted structured data as a JSON object
   */
  async executeStructuredChatWithAugmentedSystem(
    systemPromptKey: string,
    systemPromptAugmentation: string,
    userPromptKey: string,
    variables: Record<string, any>,
    jsonSchema: JsonSchema,
    history: LlmMessage[] = [],
  ): Promise<Record<string, any>> {
    const baseSystemPrompt = this.promptService.getPrompt(systemPromptKey);
    const systemPrompt = baseSystemPrompt + '\n\n' + systemPromptAugmentation;
    const userPromptTemplate = this.promptService.getPrompt(userPromptKey);
    const userMessage = this.templateService.render(userPromptTemplate, variables);

    const messages: LlmMessage[] = [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: userMessage },
    ];

    try {
      const result = await this.llmService.chatStructured(jsonSchema, messages);

      return result as Record<string, any>;
    } catch (error) {
      this.logger.error('Structured chat with augmented system failed:', error);
      return {};
    }
  }
}
