import { Injectable, Logger } from '@nestjs/common';
import { Conversation } from './conversation.entity';
import { ConversationService } from './conversation.service';
import {
  ArrayCollectionState,
  ArrayFieldTurnResult,
} from './array-collection.types';
import { ConversationResponse } from './conversation.types';
import { InterpreterService } from '../intelligence/interpreter.service';
import { PresenterService } from '../intelligence/presenter.service';
import { ValidationService } from '../../core/validation/validation.service';
import {
  ArrayFieldDefinition,
  ServiceBlueprint,
  JsonSchema,
} from '../blueprint/interfaces/blueprint.interface';

/**
 * ArrayCollectionService
 *
 * Manages the multi-turn conversational loop for collecting array-type fields.
 * Handles the COLLECTING and CONFIRMING phases defined in ArrayCollectionState.
 * Per ADR-001, returns an ArrayFieldTurnResult sentinel to signal CONTINUE or FIELD_COMPLETE.
 */
@Injectable()
export class ArrayCollectionService {
  private readonly logger = new Logger(ArrayCollectionService.name);

  constructor(
    private readonly conversationService: ConversationService,
    private readonly interpreterService: InterpreterService,
    private readonly presenterService: PresenterService,
    private readonly validationService: ValidationService,
  ) {}

  /**
   * Main entry point: dispatches to the correct handler based on current phase.
   * @param conversation The active conversation entity
   * @param blueprint The service blueprint for language config and field definitions
   * @param currentField The array field definition being collected
   */
  public async handleArrayFieldTurn(
    conversation: Conversation,
    blueprint: ServiceBlueprint,
    currentField: ArrayFieldDefinition,
  ): Promise<ArrayFieldTurnResult> {
    const state = conversation.arrayCollectionState;

    if (state === null) {
      return this.handleNoState(conversation, blueprint, currentField);
    }

    if (state.phase === 'COLLECTING' && state.pendingPartialItem !== null) {
      return this.handleCollectingWithPending(
        conversation,
        state,
        blueprint,
        currentField,
      );
    }

    if (state.phase === 'COLLECTING') {
      return this.handleCollecting(
        conversation,
        state,
        blueprint,
        currentField,
      );
    }

    // phase === 'CONFIRMING'
    return this.handleConfirming(conversation, state, blueprint, currentField);
  }

  /**
   * Handles the very first turn for an array field: initialises state and asks the opening question.
   */
  private async handleNoState(
    conversation: Conversation,
    blueprint: ServiceBlueprint,
    currentField: ArrayFieldDefinition,
  ): Promise<ArrayFieldTurnResult> {
    const state: ArrayCollectionState = {
      fieldId: currentField.id,
      phase: 'COLLECTING',
      accumulatedItems: [],
      pendingPartialItem: null,
      pendingMissingSubFields: [],
    };
    conversation.arrayCollectionState = state;

    const questionText = await this.presenterService.generateQuestion(
      currentField,
      blueprint.languageConfig,
      this.getHistory(conversation),
    );

    return this.respondAndContinue(conversation, state, questionText);
  }

  /**
   * Handles subsequent turns in COLLECTING phase when no partial item is pending.
   * Extracts items from the user message, validates complete ones, and either asks
   * a follow-up for partial items or transitions to CONFIRMING.
   */
  private async handleCollecting(
    conversation: Conversation,
    state: ArrayCollectionState,
    blueprint: ServiceBlueprint,
    currentField: ArrayFieldDefinition,
  ): Promise<ArrayFieldTurnResult> {
    const extractedItems = await this.interpreterService.extractArrayItems(
      currentField,
      blueprint.languageConfig,
      this.getHistory(conversation),
    );

    if (extractedItems.length === 0) {
      // Empty extraction — re-ask opening question
      this.logger.debug(
        `[${conversation.id}] No items extracted, re-asking opening question`,
      );
      const questionText = await this.presenterService.generateQuestion(
        currentField,
        blueprint.languageConfig,
        this.getHistory(conversation),
      );
      return this.respondAndContinue(conversation, state, questionText);
    }

    const itemSchema = this.buildItemObjectSchema(currentField);
    const completeItems = extractedItems.filter(
      (item) => item.missingSubFields.length === 0,
    );
    const partialItems = extractedItems.filter(
      (item) => item.missingSubFields.length > 0,
    );

    // Validate and accumulate complete items
    const itemsBeforeThisTurn = state.accumulatedItems.length;
    for (const item of completeItems) {
      if (
        this.validationService.validateAgainstSchema(item.values, itemSchema)
      ) {
        state.accumulatedItems.push(item.values);
        this.logger.debug(
          `[${conversation.id}] Item added to '${currentField.id}', total=${state.accumulatedItems.length}`,
        );
      } else {
        this.logger.debug(
          `[${conversation.id}] Item failed validation, skipped`,
        );
      }
    }

    // Handle partial item (take the first one if any)
    if (partialItems.length > 0) {
      const partial = partialItems[0];
      state.pendingPartialItem = partial.values;
      state.pendingMissingSubFields = partial.missingSubFields;
      this.logger.debug(
        `[${conversation.id}] Partial item pending, missing=${JSON.stringify(partial.missingSubFields)}`,
      );

      const followUpText = await this.presenterService.generateSubFieldFollowUp(
        currentField,
        partial.values,
        partial.missingSubFields,
        blueprint.languageConfig,
        this.getHistory(conversation),
      );
      return this.respondAndContinue(conversation, state, followUpText);
    }

    // All items complete — if nothing was accumulated this turn, re-ask instead of advancing
    if (state.accumulatedItems.length === itemsBeforeThisTurn) {
      this.logger.debug(
        `[${conversation.id}] All extracted items failed validation, re-asking opening question`,
      );
      const questionText = await this.presenterService.generateQuestion(
        currentField,
        blueprint.languageConfig,
        this.getHistory(conversation),
      );
      return this.respondAndContinue(conversation, state, questionText);
    }

    // At least one valid item accumulated — transition to CONFIRMING
    state.phase = 'CONFIRMING';
    const confirmationText =
      await this.presenterService.generateArrayConfirmationQuestion(
        currentField,
        state.accumulatedItems,
        blueprint.languageConfig,
        this.getHistory(conversation),
      );
    return this.respondAndContinue(conversation, state, confirmationText);
  }

  /**
   * Handles turns in COLLECTING phase when a partial item is pending resolution.
   * Extracts missing sub-field values from the user's response and either asks
   * for more missing fields or transitions to CONFIRMING once the item is complete.
   */
  private async handleCollectingWithPending(
    conversation: Conversation,
    state: ArrayCollectionState,
    blueprint: ServiceBlueprint,
    currentField: ArrayFieldDefinition,
  ): Promise<ArrayFieldTurnResult> {
    // Find the sub-field definitions for the missing fields
    const missingSubFieldDefs = currentField.items.filter((sf) =>
      state.pendingMissingSubFields.includes(sf.id),
    );

    // Extract data for the missing sub-fields only
    const { data } = await this.interpreterService.extractData(
      missingSubFieldDefs,
      blueprint.languageConfig,
      this.getHistory(conversation),
    );

    // Merge extracted data into the pending partial item
    const mergedItem = { ...state.pendingPartialItem, ...data };

    // Recompute missing sub-fields
    const stillMissing = currentField.items
      .map((sf) => sf.id)
      .filter((id) => mergedItem[id] == null);

    if (stillMissing.length > 0) {
      // Still missing some sub-fields — continue resolving
      state.pendingPartialItem = mergedItem;
      state.pendingMissingSubFields = stillMissing;

      const followUpText = await this.presenterService.generateSubFieldFollowUp(
        currentField,
        mergedItem,
        stillMissing,
        blueprint.languageConfig,
        this.getHistory(conversation),
      );
      return this.respondAndContinue(conversation, state, followUpText);
    }

    // All sub-fields resolved — validate and accumulate
    const itemSchema = this.buildItemObjectSchema(currentField);
    if (this.validationService.validateAgainstSchema(mergedItem, itemSchema)) {
      state.accumulatedItems.push(mergedItem);
      this.logger.debug(
        `[${conversation.id}] Partial item resolved and added, total=${state.accumulatedItems.length}`,
      );
    } else {
      this.logger.debug(
        `[${conversation.id}] Resolved partial item failed validation, discarded`,
      );
    }

    state.pendingPartialItem = null;
    state.pendingMissingSubFields = [];

    // Transition to CONFIRMING
    state.phase = 'CONFIRMING';
    const confirmationText =
      await this.presenterService.generateArrayConfirmationQuestion(
        currentField,
        state.accumulatedItems,
        blueprint.languageConfig,
        this.getHistory(conversation),
      );
    return this.respondAndContinue(conversation, state, confirmationText);
  }

  /**
   * Handles the CONFIRMING phase: classifies the user's response as DONE or ADD_MORE.
   * On DONE, persists the collected array to conversation.data and clears state.
   * On ADD_MORE, transitions back to COLLECTING and re-asks the opening question.
   */
  private async handleConfirming(
    conversation: Conversation,
    state: ArrayCollectionState,
    blueprint: ServiceBlueprint,
    currentField: ArrayFieldDefinition,
  ): Promise<ArrayFieldTurnResult> {
    const confirmation =
      await this.interpreterService.classifyArrayConfirmation(
        currentField,
        blueprint.languageConfig,
        this.getHistory(conversation),
      );

    if (confirmation === 'ADD_MORE') {
      state.phase = 'COLLECTING';
      const questionText = await this.presenterService.generateQuestion(
        currentField,
        blueprint.languageConfig,
        this.getHistory(conversation),
      );
      return this.respondAndContinue(conversation, state, questionText);
    }

    // DONE — validate full array and store
    const isValid = this.validationService.validateValue(
      state.accumulatedItems,
      currentField,
    );
    if (!isValid) {
      // Constraint not met (e.g. minItems) — go back to COLLECTING so the user can add more
      this.logger.warn(
        `[${conversation.id}] Array field '${currentField.id}' failed final validation (${state.accumulatedItems.length} item(s)), returning to COLLECTING`,
      );
      state.phase = 'COLLECTING';
      const questionText = await this.presenterService.generateQuestion(
        currentField,
        blueprint.languageConfig,
        this.getHistory(conversation),
      );
      return this.respondAndContinue(conversation, state, questionText);
    }

    conversation.data[currentField.id] = state.accumulatedItems;
    conversation.arrayCollectionState = null;

    this.logger.log(
      `[${conversation.id}] Array field '${currentField.id}' complete: ${state.accumulatedItems.length} item(s) collected.`,
    );

    return { outcome: 'FIELD_COMPLETE' };
  }

  /**
   * Builds a JSON Schema object-type schema for validating a single array item
   * against the sub-field definitions of the given array field.
   */
  private buildItemObjectSchema(
    currentField: ArrayFieldDefinition,
  ): JsonSchema {
    const properties: Record<string, JsonSchema> = {};
    const required: string[] = [];

    for (const subField of currentField.items) {
      properties[subField.id] = subField.validation;
      required.push(subField.id);
    }

    return {
      type: 'object',
      properties,
      required,
      additionalProperties: false,
    };
  }

  /**
   * Appends the AI response to the conversation, persists, and wraps in a CONTINUE result.
   */
  private async respondAndContinue(
    conversation: Conversation,
    state: ArrayCollectionState,
    responseText: string,
  ): Promise<ArrayFieldTurnResult> {
    conversation.arrayCollectionState = state;
    this.conversationService.appendMessage(conversation, 'ai', responseText);
    await this.conversationService.persistConversation();
    return {
      outcome: 'CONTINUE',
      response: this.buildResponse(conversation, responseText),
    };
  }

  /**
   * Builds a ConversationResponse from the conversation and a response text.
   */
  private buildResponse(
    conversation: Conversation,
    text: string,
  ): ConversationResponse {
    return {
      conversationId: conversation.id,
      text,
      isComplete: false,
      data: conversation.data,
    };
  }

  /**
   * Returns the conversation history as LlmMessage array.
   */
  private getHistory(conversation: Conversation) {
    return this.conversationService.getHistory(conversation);
  }
}
