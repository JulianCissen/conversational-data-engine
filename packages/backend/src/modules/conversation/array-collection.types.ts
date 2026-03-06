import { ConversationResponse } from './conversation.types';

/**
 * Phase of the array field collection loop.
 * COLLECTING: accumulating items from the user.
 * CONFIRMING: asking the user whether they want to add more items.
 */
export type ArrayCollectionPhase = 'COLLECTING' | 'CONFIRMING';

/**
 * Persisted sub-state for an in-progress array field collection.
 * Stored as a nullable JSONB column on the Conversation entity.
 */
export interface ArrayCollectionState {
  fieldId: string;
  phase: ArrayCollectionPhase;
  accumulatedItems: Record<string, unknown>[];
  pendingPartialItem: Record<string, unknown> | null;
  pendingMissingSubFields: string[];
}

/**
 * Sentinel return type for ArrayCollectionService.handleArrayFieldTurn().
 * CONTINUE: the array collection loop is still active; response is ready to send.
 * FIELD_COMPLETE: all items collected; ConversationFlowService should advance to next field.
 * Per ADR-001.
 */
export type ArrayFieldTurnResult =
  | { outcome: 'CONTINUE'; response: ConversationResponse }
  | { outcome: 'FIELD_COMPLETE' };
