import { Logger } from '@nestjs/common';
import { Conversation } from './conversation.entity';
import { ConversationResponse } from './conversation.types';
import { LanguageViolationException } from '../intelligence/intelligence.exceptions';
import { ConversationService } from './conversation.service';

/**
 * LanguageViolationHandler
 *
 * Centralized handler for language violation exceptions.
 * Wraps operations that may throw LanguageViolationException,
 * handling the exception by:
 * - Logging the violation
 * - Appending error message to conversation
 * - Persisting the conversation
 * - Returning appropriate error response
 *
 * Eliminates try-catch duplication across the flow service.
 */
export class LanguageViolationHandler {
  private readonly logger = new Logger(LanguageViolationHandler.name);

  constructor(private readonly conversationService: ConversationService) {}

  /**
   * Wrap an async operation that may throw LanguageViolationException.
   * If exception is thrown, handle it gracefully and return error response.
   * Otherwise, return the result of the operation.
   *
   * @param conversation - The conversation context
   * @param operation - Async operation to execute
   * @returns Either the operation result or error response
   */
  public async wrapOperation<T>(
    conversation: Conversation,
    operation: () => Promise<T>,
  ): Promise<T | { error: true; response: ConversationResponse }> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof LanguageViolationException) {
        return this.handleLanguageViolation(conversation, error);
      }
      // Re-throw non-language-violation errors
      throw error;
    }
  }

  /**
   * Handle a language violation exception
   */
  private async handleLanguageViolation(
    conversation: Conversation,
    error: LanguageViolationException,
  ): Promise<{ error: true; response: ConversationResponse }> {
    this.logger.log(
      `[${conversation.id}] Language violation - Expected: ${error.expectedLanguage}, Detected: ${error.detectedLanguage}`,
    );

    // Append error message to conversation
    this.conversationService.appendMessage(conversation, 'ai', error.message);
    await this.conversationService.persistConversation();

    // Return error response
    return {
      error: true,
      response: {
        conversationId: conversation.id,
        text: error.message,
        isComplete: false,
        data: conversation.data,
      },
    };
  }

  /**
   * Type guard to check if result is a language violation error response
   */
  public isErrorResponse<T>(
    result: T | { error: true; response: ConversationResponse },
  ): result is { error: true; response: ConversationResponse } {
    return (
      typeof result === 'object' &&
      result !== null &&
      'error' in result &&
      result.error === true
    );
  }
}
