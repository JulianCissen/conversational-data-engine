import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

@Injectable()
export class AiService {
  private readonly chatModel: ChatOpenAI;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('LLM_API_KEY');
    const baseURL = this.configService.get<string>('LLM_BASE_URL');
    const modelName = this.configService.get<string>('LLM_MODEL');

    if (!apiKey || !baseURL || !modelName) {
      throw new Error(
        'Missing required LLM configuration. Please set LLM_API_KEY, LLM_BASE_URL, and LLM_MODEL in your environment variables.',
      );
    }

    this.chatModel = new ChatOpenAI({
      apiKey,
      configuration: {
        baseURL,
      },
      modelName,
      temperature: 0, // Deterministic behavior for form data
    });
  }

  async chat(systemPrompt: string, userMessage: string): Promise<string> {
    const messages = [
      new SystemMessage(systemPrompt),
      new HumanMessage(userMessage),
    ];

    const response = await this.chatModel.invoke(messages);
    return response.content as string;
  }
}
