import { Injectable, Logger } from '@nestjs/common';
import { LlmService } from '../../core/llm/llm.service';
import { LlmMessage } from '../../core/llm/llm.types';
import { SystemMessageBuilder } from './system-message.builder';

/**
 * Service for executing LLM calls with pre-constructed system messages.
 * Acts as a thin execution layer that delegates to LlmService.
 */
@Injectable()
export class PromptExecutionService {
  private readonly logger = new Logger(PromptExecutionService.name);

  constructor(private readonly llmService: LlmService) {}

  /**
   * Execute a chat completion with a system message builder and user message.
   * @param builder SystemMessageBuilder containing the constructed system context
   * @param history Optional conversation history to include
   * @param userMessage The raw user message
   * @returns The LLM response as a string
   */
  public async executeChat(
    builder: SystemMessageBuilder,
    history: LlmMessage[] = [],
    userMessage: string,
  ): Promise<string> {
    const systemMessage = builder.buildSystemMessage();

    const messages: LlmMessage[] = [
      { role: 'system', content: systemMessage },
      ...history,
      { role: 'user', content: userMessage },
    ];

    return await this.llmService.chat(messages);
  }

  /**
   * Execute a structured chat completion with a system message builder and user message.
   * @param builder SystemMessageBuilder containing the constructed system context and schema
   * @param history Optional conversation history to include
   * @param userMessage The raw user message
   * @returns The extracted data as a JSON object
   */
  public async executeStructuredChat(
    builder: SystemMessageBuilder,
    history: LlmMessage[] = [],
    userMessage: string,
  ): Promise<Record<string, any>> {
    const systemMessage = builder.buildSystemMessage();
    const jsonSchema = builder.getSchema();

    const messages: LlmMessage[] = [
      { role: 'system', content: systemMessage },
      ...history,
      { role: 'user', content: userMessage },
    ];

    try {
      const result = await this.llmService.chatStructured(jsonSchema, messages);
      this.logger.debug(
        `[executeStructuredChat] LLM output: ${JSON.stringify(result)}`,
      );
      return result as Record<string, any>;
    } catch (error) {
      this.logger.error('[executeStructuredChat] Failed:', error);
      return {};
    }
  }
}
