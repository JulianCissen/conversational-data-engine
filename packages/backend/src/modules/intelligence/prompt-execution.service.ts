import { Injectable } from '@nestjs/common';
import { LlmService } from '../../core/llm/llm.service';
import { PromptService } from '../../core/prompt/prompt.service';
import { TemplateService } from '../../core/template/template.service';
import { JsonSchema } from '../blueprint/interfaces/blueprint.interface';

/**
 * Service for executing prompts with template rendering and LLM invocation.
 * Abstracts the common pattern of: get prompt -> render template -> call LLM.
 */
@Injectable()
export class PromptExecutionService {
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
   * @returns The LLM response as a string
   */
  async executeChat(
    systemPromptKey: string,
    userPromptKey: string,
    variables: Record<string, any>,
  ): Promise<string> {
    const systemPrompt = this.promptService.getPrompt(systemPromptKey);
    const userPromptTemplate = this.promptService.getPrompt(userPromptKey);
    const userMessage = this.templateService.render(userPromptTemplate, variables);

    return await this.llmService.chat(systemPrompt, userMessage);
  }

  /**
   * Execute a chat completion with a system prompt that also requires template rendering.
   * @param systemPromptKey The key for the system prompt template
   * @param systemVariables Variables to render in the system prompt template
   * @param userPromptKey The key for the user prompt
   * @param userVariables Variables to render in the user prompt template
   * @returns The LLM response as a string
   */
  async executeChatWithSystemTemplate(
    systemPromptKey: string,
    systemVariables: Record<string, any>,
    userPromptKey: string,
    userVariables: Record<string, any>,
  ): Promise<string> {
    const systemPromptTemplate = this.promptService.getPrompt(systemPromptKey);
    const systemPrompt = this.templateService.render(systemPromptTemplate, systemVariables);
    
    const userPromptTemplate = this.promptService.getPrompt(userPromptKey);
    const userMessage = this.templateService.render(userPromptTemplate, userVariables);

    return await this.llmService.chat(systemPrompt, userMessage);
  }

  /**
   * Execute structured data extraction with a JSON schema.
   * @param systemPromptKey The key for the system prompt
   * @param userMessage The user's raw message
   * @param jsonSchema The JSON schema for structured output
   * @returns The extracted data as a JSON object
   */
  async executeStructuredExtraction(
    systemPromptKey: string,
    userMessage: string,
    jsonSchema: JsonSchema,
  ): Promise<Record<string, any>> {
    const systemPrompt = this.promptService.getPrompt(systemPromptKey);

    try {
      const structuredModel = this.llmService.chatModel.withStructuredOutput(jsonSchema);
      const result = await structuredModel.invoke([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ]);

      return result as Record<string, any>;
    } catch (error) {
      console.error('Structured extraction failed:', error);
      return {};
    }
  }
}
