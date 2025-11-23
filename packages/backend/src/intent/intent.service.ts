import { Injectable } from '@nestjs/common';
import { AiService } from '../ai/ai.service';
import { FieldDefinition, ServiceBlueprint } from '../blueprint/interfaces/blueprint.interface';
import { PromptService } from '../config/prompt.service';
import { TemplateService } from '../template/template.service';

export type UserIntent = 'ANSWER' | 'QUESTION';
export type ServiceSelectionIntent = string | 'LIST_SERVICES' | 'UNCLEAR';

@Injectable()
export class IntentService {
  constructor(
    private readonly aiService: AiService,
    private readonly promptService: PromptService,
    private readonly templateService: TemplateService,
  ) {}

  /**
   * Classify the user's intent based on their message and the current field.
   * Determines if the user is trying to answer the question or asking for clarification.
   * @param userText The user's message
   * @param currentField The current field being collected
   * @returns 'ANSWER' if providing data, 'QUESTION' if asking for clarification
   */
  async classifyIntent(
    userText: string,
    currentField: FieldDefinition,
  ): Promise<UserIntent> {
    const systemPrompt = this.promptService.getPrompt('intent.classification.system');
    
    const userMessageTemplate = this.promptService.getPrompt('intent.classification.user');
    const userMessage = this.templateService.render(userMessageTemplate, {
      questionTemplate: currentField.questionTemplate,
      aiContext: currentField.aiContext,
      userText: userText,
    });

    const response = await this.aiService.chat(systemPrompt, userMessage);
    const intent = response.trim().toUpperCase();

    // Validate and return the intent
    if (intent === 'ANSWER' || intent === 'QUESTION') {
      return intent;
    }

    // Default to ANSWER if unclear (safer to attempt extraction)
    return 'ANSWER';
  }

  /**
   * Classify which service the user wants to select based on their message.
   * Uses LLM to match user intent to available services.
   * @param userText The user's message
   * @param services Array of available service blueprints
   * @returns The blueprint ID if matched, 'LIST_SERVICES' if asking for a list, 'UNCLEAR' if uncertain
   */
  async classifyServiceSelection(
    userText: string,
    services: ServiceBlueprint[],
  ): Promise<ServiceSelectionIntent> {
    // Build service list for the prompt
    const serviceList = services
      .map((s) => `- ${s.id}: ${s.name}`)
      .join('\n');

    const systemPromptTemplate = this.promptService.getPrompt('service.selection.system');
    const systemPrompt = this.templateService.render(systemPromptTemplate, {
      serviceList: serviceList,
    });

    const userMessageTemplate = this.promptService.getPrompt('service.selection.user');
    const userMessage = this.templateService.render(userMessageTemplate, {
      userText: userText,
    });

    const response = await this.aiService.chat(systemPrompt, userMessage);
    const intent = response.trim();

    // Validate response
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
