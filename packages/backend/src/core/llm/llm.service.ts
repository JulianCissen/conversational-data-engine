import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { LlmConfigSchema, LlmConfig } from './llm.config';

@Injectable()
export class LlmService {
  private readonly _chatModel: ChatOpenAI;
  private readonly config: LlmConfig;

  constructor(private readonly configService: ConfigService) {
    this.config = this.loadAndValidateConfig();
    this._chatModel = this.initializeChatModel();
  }

  /**
   * Load configuration from environment variables and validate with Zod.
   * @returns Validated LLM configuration
   * @throws Error if configuration is invalid
   */
  private loadAndValidateConfig(): LlmConfig {
    const rawConfig = {
      apiKey: this.configService.get<string>('LLM_API_KEY'),
      baseURL: this.configService.get<string>('LLM_BASE_URL'),
      modelName: this.configService.get<string>('LLM_MODEL'),
      temperature: this.configService.get<number>('LLM_TEMPERATURE') ?? 0,
    };

    try {
      return LlmConfigSchema.parse(rawConfig);
    } catch (error) {
      throw new Error(
        `Invalid LLM configuration: ${error.message}. ` +
        'Please check LLM_API_KEY, LLM_BASE_URL, and LLM_MODEL environment variables.',
      );
    }
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
