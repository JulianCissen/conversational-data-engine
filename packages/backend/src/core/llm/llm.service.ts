import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { LlmConfig, loadAndValidateLlmConfig } from './llm.config';

@Injectable()
export class LlmService {
  private readonly _chatModel: ChatOpenAI;
  private readonly config: LlmConfig;

  constructor(private readonly configService: ConfigService) {
    this.config = this.resolveConfig();
    this._chatModel = this.initializeChatModel();
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
   * Public getter for the chat model to allow structured output usage
   */
  get chatModel(): ChatOpenAI {
    return this._chatModel;
  }

  async chat(systemPrompt: string, userMessage: string): Promise<string> {
    const messages = [
      new SystemMessage(systemPrompt),
      new HumanMessage(userMessage),
    ];

    const response = await this._chatModel.invoke(messages);
    return response.content as string;
  }
}
