import { Injectable } from '@nestjs/common';
import * as jsonLogic from 'json-logic-js';
import { ServiceBlueprint } from '../blueprint/interfaces/blueprint.interface';

/**
 * Result of determining the next step in the conversational flow.
 */
export interface NextStepResult {
  /**
   * The ID of the next field to ask, or null if the flow is complete.
   */
  nextFieldId: string | null;

  /**
   * Indicates whether all required fields have been satisfied.
   */
  isComplete: boolean;
}

/**
 * Workflow Service
 *
 * Acts as the deterministic State Machine for the conversational data engine.
 * Given a ServiceBlueprint and current conversation data, it determines which field
 * should be asked next based on:
 * - Whether a field has already been answered
 * - Whether a field is visible (JsonLogic condition evaluation)
 */
@Injectable()
export class WorkflowService {
  /**
   * Determines the next field to be asked in the conversational flow.
   *
   * @param blueprint - The service blueprint defining the conversational flow
   * @param data - Current conversation data as key-value pairs (fieldId -> value)
   * @returns An object indicating the next field ID or completion status
   */
  determineNextStep(
    blueprint: ServiceBlueprint,
    data: Record<string, any>,
  ): NextStepResult {
    // Iterate through all fields in order
    for (const field of blueprint.fields) {
      // Check if the field is already answered
      const isAnswered =
        data[field.id] !== undefined && data[field.id] !== null;

      if (isAnswered) {
        // Skip this field, it's already satisfied
        continue;
      }

      // Check visibility using JsonLogic
      const isVisible = this.isFieldVisible(field.condition, data);

      if (!isVisible) {
        // Skip this field, it's hidden by conditional logic
        continue;
      }

      // This field is not answered and is visible
      // It's the next field to ask
      return {
        nextFieldId: field.id,
        isComplete: false,
      };
    }

    // All fields have been processed
    // Either they're answered or hidden
    return {
      nextFieldId: null,
      isComplete: true,
    };
  }

  /**
   * Evaluates whether a field is visible based on its JsonLogic condition.
   *
   * @param condition - The JsonLogic condition, or undefined if always visible
   * @param data - Current conversation data to evaluate against
   * @returns true if the field should be visible, false otherwise
   */
  private isFieldVisible(
    condition: any | undefined,
    data: Record<string, any>,
  ): boolean {
    // If no condition is defined, the field is always visible
    if (condition === undefined) {
      return true;
    }

    // Evaluate the JsonLogic condition
    const result = jsonLogic.apply(condition, data);

    // Convert the result to boolean (in case of truthy/falsy values)
    return Boolean(result);
  }
}
