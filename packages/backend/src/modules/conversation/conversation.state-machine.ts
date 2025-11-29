import { Logger } from '@nestjs/common';
import { Conversation } from './conversation.entity';
import { ServiceBlueprint } from '../blueprint/interfaces/blueprint.interface';
import { ConversationState } from './conversation.types';

/**
 * ConversationStateMachine
 *
 * Manages explicit state transitions for conversations.
 * Determines current state and handles transitions between:
 * - SERVICE_SELECTION: User is selecting which service to use
 * - DATA_COLLECTION: Collecting data fields from the user
 * - COMPLETION: All data collected, conversation complete
 */
export class ConversationStateMachine {
  private readonly logger = new Logger(ConversationStateMachine.name);

  /**
   * Determine the current state of a conversation
   */
  public getCurrentState(conversation: Conversation): ConversationState {
    // No service selected - must be in service selection
    if (!conversation.blueprintId) {
      return ConversationState.SERVICE_SELECTION;
    }

    // Service selected but conversation is marked complete
    if (conversation.status === 'COMPLETED') {
      return ConversationState.COMPLETION;
    }

    // Service selected and still collecting data
    return ConversationState.DATA_COLLECTION;
  }

  /**
   * Transition conversation to data collection state.
   * Can only be called from SERVICE_SELECTION state.
   */
  public transitionToDataCollection(
    conversation: Conversation,
    blueprintId: string,
    initialFieldId: string,
  ): void {
    const currentState = this.getCurrentState(conversation);
    if (currentState !== ConversationState.SERVICE_SELECTION) {
      throw new Error(
        `Cannot transition to DATA_COLLECTION from ${currentState}. Only forward transitions allowed.`,
      );
    }

    conversation.blueprintId = blueprintId;
    conversation.currentFieldId = initialFieldId;
    conversation.status = 'COLLECTING';
    this.logger.debug(
      `[${conversation.id}] Transitioned to DATA_COLLECTION (blueprint: ${blueprintId}, field: ${initialFieldId})`,
    );
  }

  /**
   * Transition conversation to completion state.
   * Can only be called from DATA_COLLECTION state.
   * This is a terminal state - once complete, the conversation cannot be continued.
   */
  public transitionToCompletion(conversation: Conversation): void {
    const currentState = this.getCurrentState(conversation);
    if (currentState !== ConversationState.DATA_COLLECTION) {
      throw new Error(
        `Cannot transition to COMPLETION from ${currentState}. Only forward transitions allowed.`,
      );
    }

    conversation.status = 'COMPLETED';
    conversation.currentFieldId = undefined;
    this.logger.debug(`[${conversation.id}] Transitioned to COMPLETION`);
  }

  /**
   * Progress to next field in data collection
   */
  public progressToNextField(
    conversation: Conversation,
    nextFieldId: string | null,
  ): void {
    if (nextFieldId === null) {
      this.transitionToCompletion(conversation);
    } else {
      conversation.currentFieldId = nextFieldId;
      this.logger.debug(
        `[${conversation.id}] Progressed to field: ${nextFieldId}`,
      );
    }
  }

  /**
   * Validate state transition is allowed.
   * State machine only allows forward progression:
   * SERVICE_SELECTION -> DATA_COLLECTION -> COMPLETION
   */
  public canTransition(
    currentState: ConversationState,
    targetState: ConversationState,
  ): boolean {
    const validTransitions: Record<ConversationState, ConversationState[]> = {
      [ConversationState.SERVICE_SELECTION]: [
        ConversationState.DATA_COLLECTION,
      ],
      [ConversationState.DATA_COLLECTION]: [ConversationState.COMPLETION],
      [ConversationState.COMPLETION]: [], // Terminal state - no transitions allowed
    };

    return validTransitions[currentState]?.includes(targetState) ?? false;
  }

  /**
   * Get a human-readable description of the current state
   */
  public getStateDescription(
    state: ConversationState,
    blueprint?: ServiceBlueprint,
  ): string {
    switch (state) {
      case ConversationState.SERVICE_SELECTION:
        return 'Waiting for user to select a service';
      case ConversationState.DATA_COLLECTION:
        return blueprint
          ? `Collecting data for service: ${blueprint.name}`
          : 'Collecting data';
      case ConversationState.COMPLETION:
        return blueprint
          ? `Completed service: ${blueprint.name}`
          : 'Conversation complete';
    }
  }
}
