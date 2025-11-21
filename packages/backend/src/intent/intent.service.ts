import { Injectable } from '@nestjs/common';
import { AiService } from '../ai/ai.service';
import { FieldDefinition } from '../blueprint/interfaces/blueprint.interface';

export type UserIntent = 'ANSWER' | 'QUESTION';

@Injectable()
export class IntentService {
  constructor(private readonly aiService: AiService) {}

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
    const systemPrompt = `You are an intent classifier for a conversational form system. 
Your task is to determine if the user is:
- ANSWER: Providing data/information to answer the current question
- QUESTION: Asking a clarifying question about the form, the field, or why information is needed

Respond with ONLY the word "ANSWER" or "QUESTION" - nothing else.`;

    const userMessage = `Current field being collected: "${currentField.questionTemplate}"
Context: ${currentField.aiContext}

User's message: "${userText}"

Is the user providing an ANSWER or asking a QUESTION?`;

    const response = await this.aiService.chat(systemPrompt, userMessage);
    const intent = response.trim().toUpperCase();

    // Validate and return the intent
    if (intent === 'ANSWER' || intent === 'QUESTION') {
      return intent;
    }

    // Default to ANSWER if unclear (safer to attempt extraction)
    return 'ANSWER';
  }
}
