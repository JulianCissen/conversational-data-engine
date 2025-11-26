import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatOpenAI } from '@langchain/openai';
import { BaseMessage, HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';
import { LlmConfig, loadAndValidateLlmConfig } from './llm.config';
import { LlmMessage } from './llm.types';

@Injectable()
export class LlmService {
  private readonly chatModel: ChatOpenAI;
  private readonly config: LlmConfig;

  /**
   * Initialize LLM service with validated configuration.
   * @param configService - NestJS ConfigService instance
   */
  constructor(private readonly configService: ConfigService) {
    this.config = this.resolveConfig();
    this.chatModel = this.initializeChatModel();
  }

  /**
   * Load configuration from environment variables and validate with Zod.
   * @returns Validated LLM configuration
   * @throws Error if configuration is invalid
   */
  private resolveConfig(): LlmConfig {
    return loadAndValidateLlmConfig(this.configService);
  }

  /**
   * Initialize the ChatOpenAI model with validated configuration.
   * @returns Configured ChatOpenAI instance
   */
  private initializeChatModel(): ChatOpenAI {
    return new ChatOpenAI({
      apiKey: this.config.apiKey,
      configuration: {
        baseURL: this.config.baseURL,
      },
      modelName: this.config.modelName,
      temperature: this.config.temperature,
    });
  }

  /**
   * Convert generic message format to LangChain message instances.
   * @param messages - Array of messages with role and content
   * @returns Array of LangChain BaseMessage instances
   */
  private convertToLangChainMessages(messages: LlmMessage[]): BaseMessage[] {
    return messages.map((msg) => {
      if (msg.role === 'system') {
        return new SystemMessage(msg.content);
      }
      if (msg.role === 'ai') {
        return new AIMessage(msg.content);
      }
      return new HumanMessage(msg.content);
    });
  }

  /**
   * Send chat messages to the LLM and receive a response.
   * @param messages - Array of messages with role and content
   * @returns The LLM response as a string
   * @throws Error if response content is not a string
   */
  async chat(messages: LlmMessage[]): Promise<string> {
    const langchainMessages = this.convertToLangChainMessages(messages);
    const response = await this.chatModel.invoke(langchainMessages);

    if (typeof response.content !== 'string') {
      throw new Error(
        `Expected string response from LLM, got ${typeof response.content}`,
      );
    }

    return response.content;
  }

  /**
   * Send chat messages to the LLM with structured output using a JSON schema.
   * @param jsonSchema - JSON schema for structured output validation
   * @param messages - Array of messages with role and content
   * @returns The structured output matching the schema
   */
  async chatStructured<T extends Record<string, unknown>>(
    jsonSchema: Record<string, unknown>,
    messages: LlmMessage[],
  ): Promise<T> {
    const langchainMessages = this.convertToLangChainMessages(messages);
    const structuredModel = this.chatModel.withStructuredOutput(jsonSchema);
    return await structuredModel.invoke(langchainMessages) as T;
  }
}
