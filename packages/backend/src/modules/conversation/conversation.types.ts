/**
 * Standard response type for conversation flow operations.
 * Returned by all conversation handler methods.
 */
export interface ConversationResponse {
  conversationId: string;
  text: string;
  isComplete: boolean;
  data: Record<string, any>;
}

/**
 * Conversation states in the explicit state machine.
 */
export enum ConversationState {
  SERVICE_SELECTION = 'SERVICE_SELECTION',
  DATA_COLLECTION = 'DATA_COLLECTION',
  COMPLETION = 'COMPLETION',
}
