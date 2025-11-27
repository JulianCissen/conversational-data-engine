import { Injectable, Logger } from '@nestjs/common';
import * as jsonLogic from 'json-logic-js';
import {
  ServiceBlueprint,
  FieldDefinition,
} from '../blueprint/interfaces/blueprint.interface';
import { ValidationService } from '../../core/validation/validation.service';

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
  private readonly logger = new Logger(WorkflowService.name);

  constructor(private readonly validationService: ValidationService) {}
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
    for (const field of blueprint.fields) {
      if (this.isFieldSatisfied(field, data)) {
        continue;
      }

      // This field is not satisfied - it's the next field to ask
      return {
        nextFieldId: field.id,
        isComplete: false,
      };
    }

    // All fields have been processed
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
    condition: unknown,
    data: Record<string, any>,
  ): boolean {
    // If no condition is defined, the field is always visible
    if (condition === undefined) {
      return true;
    }

    // Evaluate the JsonLogic condition
    const result = jsonLogic.apply(
      condition as jsonLogic.RulesLogic,
      data,
    ) as unknown;

    // Convert the result to boolean (in case of truthy/falsy values)
    return Boolean(result);
  }

  /**
   * Check if a field is satisfied (answered and visible).
   * @param field The field definition to check
   * @param data Current conversation data
   * @returns true if the field is satisfied (answered or hidden), false otherwise
   */
  private isFieldSatisfied(
    field: FieldDefinition,
    data: Record<string, any>,
  ): boolean {
    // Check if the field is already answered
    const isAnswered = data[field.id] !== undefined && data[field.id] !== null;

    if (isAnswered) {
      return true;
    }

    // Check if the field is hidden by conditional logic
    const isVisible = this.isFieldVisible(field.condition, data);

    return !isVisible;
  }

  /**
   * Validates field data according to business rules.
   * Delegates to ValidationService for comprehensive validation.
   *
   * @param value - The extracted value to validate
   * @param field - The field definition containing type information
   * @returns true if the value is valid, false otherwise
   */
  validateValue(value: any, field: FieldDefinition): boolean {
    return this.validationService.validateValue(value, field);
  }
}
