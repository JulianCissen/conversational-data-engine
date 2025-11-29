import { Injectable, Logger } from '@nestjs/common';
import { Conversation } from './conversation.entity';
import { LlmMessage } from '../../core/llm/llm.types';
import { WorkflowService } from '../workflow/workflow.service';
import { InterpreterService } from '../intelligence/interpreter.service';
import { PresenterService } from '../intelligence/presenter.service';
import { ServiceBlueprint } from '../blueprint/interfaces/blueprint.interface';
import { BlueprintService } from '../blueprint/blueprint.service';
import { ConversationService } from './conversation.service';
import { ConversationResponse, ConversationState } from './conversation.types';
import { ConversationStateMachine } from './conversation.state-machine';
import { PluginOrchestrator } from './plugin.orchestrator';
import { LanguageViolationHandler } from './language-violation.handler';
import { PluginManagerService } from '../../core/plugin/plugin.service';

/**
 * ConversationFlowService
 *
 * Orchestrates the conversational flow by coordinating all services.
 * Uses explicit state machine pattern and delegates:
 * - State transitions to ConversationStateMachine
 * - Plugin execution to PluginOrchestrator
 * - Language violation handling to LanguageViolationHandler
 */
@Injectable()
export class ConversationFlowService {
  private readonly logger = new Logger(ConversationFlowService.name);
  private readonly stateMachine: ConversationStateMachine;
  private readonly pluginOrchestrator: PluginOrchestrator;
  private readonly languageViolationHandler: LanguageViolationHandler;

  constructor(
    private readonly conversationService: ConversationService,
    private readonly workflowService: WorkflowService,
    private readonly interpreterService: InterpreterService,
    private readonly presenterService: PresenterService,
    private readonly blueprintService: BlueprintService,
    private readonly pluginManagerService: PluginManagerService,
  ) {
    this.stateMachine = new ConversationStateMachine();
    this.pluginOrchestrator = new PluginOrchestrator(pluginManagerService);
    this.languageViolationHandler = new LanguageViolationHandler(
      conversationService,
    );
  }

  /**
   * Main message handling logic - The Coordinator
   * Orchestrates the conversation flow using explicit state machine
   */
  public async handleMessage(
    conversationId: string | undefined,
    userText: string,
  ): Promise<ConversationResponse> {
    const conversation =
      await this.conversationService.getOrCreateConversation(conversationId);

    // Handle new conversation - store welcome message first
    if (!conversationId) {
      await this.sendWelcomeMessage(conversation);
    }

    // Append user message to history
    this.conversationService.appendMessage(conversation, 'user', userText);

    // Route based on current state
    const currentState = this.stateMachine.getCurrentState(conversation);

    switch (currentState) {
      case ConversationState.SERVICE_SELECTION:
        return await this.handleServiceSelectionState(conversation);

      case ConversationState.DATA_COLLECTION:
        return await this.handleDataCollectionState(conversation);

      case ConversationState.COMPLETION:
        // Conversation is complete - inform user to start a new one
        return await this.handleCompletionState(conversation);

      default:
        throw new Error('Unknown conversation state');
    }
  }

  // ========================================
  // Service Selection State Handlers
  // ========================================

  /**
   * Handle SERVICE_SELECTION state
   * User is selecting which service to use
   */
  private async handleServiceSelectionState(
    conversation: Conversation,
  ): Promise<ConversationResponse> {
    const availableServices = this.blueprintService.getAllBlueprints();
    const history = this.getHistory(conversation);

    const selectionIntent =
      await this.interpreterService.classifyServiceSelection(
        availableServices,
        history,
      );

    // User is asking for a list of services
    if (selectionIntent === 'LIST_SERVICES') {
      const responseText = await this.presenterService.generateServiceList(
        availableServices,
        undefined,
        history,
      );
      return this.respondAndPersist(conversation, responseText, false);
    }

    // Intent is unclear
    if (selectionIntent === 'UNCLEAR') {
      const responseText =
        await this.presenterService.generateUnclearSelectionResponse(
          undefined,
          history,
        );
      return this.respondAndPersist(conversation, responseText, false);
    }

    // Service was selected - transition to data collection
    return await this.transitionToDataCollection(conversation, selectionIntent);
  }

  /**
   * Transition from service selection to data collection
   */
  private async transitionToDataCollection(
    conversation: Conversation,
    blueprintId: string,
  ): Promise<ConversationResponse> {
    const blueprint = this.getBlueprint(blueprintId);

    // Announce language requirement if strict mode
    if (blueprint.languageConfig?.mode === 'strict') {
      const languageAnnouncement =
        await this.presenterService.getLanguageRequirementAnnouncement(
          blueprint.languageConfig.defaultLanguage,
        );
      this.conversationService.appendMessage(
        conversation,
        'ai',
        languageAnnouncement,
      );
    }

    // Execute onStart hooks with validation
    await this.executeOnStartHooks(conversation, blueprint);

    // Determine first field
    const nextStep = this.workflowService.determineNextStep(
      blueprint,
      conversation.data,
    );

    if (!nextStep.nextFieldId) {
      throw new Error(
        'Unable to initialize conversation: no starting field found',
      );
    }

    // Transition state
    this.stateMachine.transitionToDataCollection(
      conversation,
      blueprintId,
      nextStep.nextFieldId,
    );

    // Ask first question
    const field = this.findField(blueprint, nextStep.nextFieldId);
    const questionText = await this.presenterService.generateQuestion(
      field,
      blueprint.languageConfig,
      this.getHistory(conversation),
    );

    return this.respondAndPersist(conversation, questionText, false);
  }

  // ========================================
  // Data Collection State Handlers
  // ========================================

  /**
   * Handle DATA_COLLECTION state
   * User is providing data to fill fields
   */
  private async handleDataCollectionState(
    conversation: Conversation,
  ): Promise<ConversationResponse> {
    const blueprint = this.getBlueprint(conversation.blueprintId!);
    const currentField = this.findField(
      blueprint,
      conversation.currentFieldId!,
    );

    // Wrap in language violation handler
    const result = await this.languageViolationHandler.wrapOperation(
      conversation,
      async () =>
        await this.processUserIntent(conversation, blueprint, currentField),
    );

    // Check if language violation occurred
    if (this.languageViolationHandler.isErrorResponse(result)) {
      return result.response;
    }

    return result;
  }

  /**
   * Process user intent (question or answer)
   */
  private async processUserIntent(
    conversation: Conversation,
    blueprint: ServiceBlueprint,
    currentField: ServiceBlueprint['fields'][number],
  ): Promise<ConversationResponse> {
    const history = this.getHistory(conversation);
    const languageConfig = blueprint.languageConfig;

    // Classify intent
    const intentClassification = await this.interpreterService.classifyIntent(
      currentField,
      languageConfig,
      history,
    );

    // Log non-answer intents
    if (intentClassification.intent !== 'ANSWER') {
      this.logNonAnswerIntent(conversation, intentClassification);
    }

    // Branch based on intent
    if (intentClassification.intent === 'QUESTION') {
      return await this.handleClarificationQuestion(
        conversation,
        blueprint,
        currentField,
      );
    }

    // User is providing an answer
    return await this.handleAnswerProvision(
      conversation,
      blueprint,
      currentField,
    );
  }

  /**
   * Handle clarification question from user
   */
  private async handleClarificationQuestion(
    conversation: Conversation,
    blueprint: ServiceBlueprint,
    currentField: ServiceBlueprint['fields'][number],
  ): Promise<ConversationResponse> {
    const responseText = await this.presenterService.generateContextualResponse(
      currentField,
      blueprint.languageConfig,
      this.getHistory(conversation),
    );

    return this.respondAndPersist(conversation, responseText, false);
  }

  /**
   * Handle answer provision from user
   */
  private async handleAnswerProvision(
    conversation: Conversation,
    blueprint: ServiceBlueprint,
    currentField: ServiceBlueprint['fields'][number],
  ): Promise<ConversationResponse> {
    // Extract and validate data (may throw LanguageViolationException - handled by parent)
    const extractionResult = await this.extractAndValidateField(
      conversation,
      blueprint,
      currentField,
    );

    // Check if validation failed
    if (!extractionResult.success) {
      return extractionResult.validationError;
    }

    // Update conversation data
    const { data, fieldValue } = extractionResult;
    conversation.data = { ...conversation.data, ...data };

    // Execute onFieldValidated hooks with validation
    await this.executeOnFieldValidatedHooks(
      conversation,
      blueprint,
      currentField.id,
      fieldValue,
    );

    // Progress to next step
    return await this.progressToNextStep(conversation, blueprint);
  }

  /**
   * Extract and validate field data.
   * May throw LanguageViolationException - handled by parent wrapper.
   */
  private async extractAndValidateField(
    conversation: Conversation,
    blueprint: ServiceBlueprint,
    currentField: ServiceBlueprint['fields'][number],
  ): Promise<
    | {
        success: true;
        data: Record<string, any>;
        fieldValue: string | number | boolean | Date;
      }
    | { success: false; validationError: ConversationResponse }
  > {
    const history = this.getHistory(conversation);
    const languageConfig = blueprint.languageConfig;

    // Extract data from user message
    const { data: extractedData, fieldValue } = await this.extractFieldData(
      conversation,
      currentField,
      languageConfig,
      history,
    );

    // Validate extracted value
    const isValid = this.validateFieldValue(fieldValue, currentField);
    this.logValidationResult(
      conversation.id,
      currentField.id,
      isValid,
      currentField.validation,
      fieldValue,
    );

    // Handle validation failure
    if (!isValid) {
      const validationError = await this.handleValidationFailure(
        conversation,
        currentField,
        languageConfig,
        history,
      );
      return { success: false, validationError };
    }

    return {
      success: true,
      data: extractedData,
      fieldValue: fieldValue as string | number | boolean | Date,
    };
  }

  /**
   * Extract data from user message and update detected language
   */
  private async extractFieldData(
    conversation: Conversation,
    currentField: ServiceBlueprint['fields'][number],
    languageConfig: ServiceBlueprint['languageConfig'],
    history: LlmMessage[],
  ): Promise<{
    data: Record<string, any>;
    fieldValue: string | number | boolean | Date | undefined;
  }> {
    // Extract data from user's message (may throw LanguageViolationException)
    const extractionResult = await this.interpreterService.extractData(
      [currentField],
      languageConfig,
      history,
    );

    // Update current language if detected
    if (extractionResult.userMessageLanguage && !conversation.currentLanguage) {
      conversation.currentLanguage = extractionResult.userMessageLanguage;
      this.logger.log(
        `[${conversation.id}] Detected user language: ${extractionResult.userMessageLanguage}`,
      );
    }

    const extractedData = extractionResult.data;
    const fieldValue: string | number | boolean | Date | undefined =
      extractedData[currentField.id] as
        | string
        | number
        | boolean
        | Date
        | undefined;

    return { data: extractedData, fieldValue };
  }

  /**
   * Validate extracted field value against field rules
   */
  private validateFieldValue(
    fieldValue: string | number | boolean | Date | undefined,
    currentField: ServiceBlueprint['fields'][number],
  ): boolean {
    return this.workflowService.validateValue(fieldValue, currentField);
  }

  /**
   * Log validation result
   */
  private logValidationResult(
    conversationId: string,
    fieldId: string,
    isValid: boolean,
    validation: any,
    fieldValue: any,
  ): void {
    if (isValid) {
      this.logger.log(
        `[${conversationId}] Validation passed for field '${fieldId}'`,
      );
    } else {
      this.logger.debug(
        `[${conversationId}] Validation for '${fieldId}': FAIL`,
      );
      this.logger.debug(
        `[${conversationId}] Validation failed - Expected: ${JSON.stringify(validation)}, Received: ${JSON.stringify(fieldValue)}`,
      );
    }
  }

  /**
   * Handle validation failure by generating error response
   */
  private async handleValidationFailure(
    conversation: Conversation,
    currentField: ServiceBlueprint['fields'][number],
    languageConfig: ServiceBlueprint['languageConfig'],
    history: LlmMessage[],
  ): Promise<ConversationResponse> {
    const errorResponse = await this.presenterService.generateErrorResponse(
      currentField,
      undefined,
      languageConfig,
      history,
    );

    return await this.respondAndPersist(conversation, errorResponse, false);
  }

  /**
   * Progress conversation to next step
   */
  private async progressToNextStep(
    conversation: Conversation,
    blueprint: ServiceBlueprint,
  ): Promise<ConversationResponse> {
    // Determine next step
    const nextStep = this.workflowService.determineNextStep(
      blueprint,
      conversation.data,
    );

    // Update state machine and persist
    this.stateMachine.progressToNextField(conversation, nextStep.nextFieldId);
    await this.conversationService.persistConversation();

    // Route based on whether conversation is complete
    if (nextStep.isComplete) {
      return await this.handleConversationCompletion(conversation, blueprint);
    }

    if (nextStep.nextFieldId) {
      return await this.askNextQuestion(
        conversation,
        blueprint,
        nextStep.nextFieldId,
      );
    }

    // Fallback (should not happen)
    return this.buildResponse(
      conversation,
      this.presenterService.getFallbackMessage(),
      false,
    );
  }

  /**
   * Handle conversation completion: execute hooks and generate completion message
   */
  private async handleConversationCompletion(
    conversation: Conversation,
    blueprint: ServiceBlueprint,
  ): Promise<ConversationResponse> {
    await this.pluginOrchestrator.executeOnConversationCompleteHooks(
      conversation,
      blueprint,
    );

    const completionText =
      await this.presenterService.generateCompletionMessage(
        blueprint.name,
        blueprint.languageConfig,
        this.getHistory(conversation),
      );

    return this.respondAndPersist(conversation, completionText, true);
  }

  /**
   * Ask next question in the conversation flow
   */
  private async askNextQuestion(
    conversation: Conversation,
    blueprint: ServiceBlueprint,
    nextFieldId: string,
  ): Promise<ConversationResponse> {
    const nextField = this.findField(blueprint, nextFieldId);
    const questionText = await this.presenterService.generateQuestion(
      nextField,
      blueprint.languageConfig,
      this.getHistory(conversation),
    );

    return this.respondAndPersist(conversation, questionText, false);
  }

  /**
   * Handle COMPLETION state
   * Conversation is complete - inform user to start a new conversation for another service
   */
  private async handleCompletionState(
    conversation: Conversation,
  ): Promise<ConversationResponse> {
    const blueprint = conversation.blueprintId
      ? this.getBlueprint(conversation.blueprintId)
      : undefined;

    const responseText = await this.presenterService.generateCompletionMessage(
      blueprint?.name || 'Service',
      blueprint?.languageConfig,
      this.getHistory(conversation),
    );

    // Add a note that they need to start a new conversation
    const finalMessage = `${responseText}\n\nThis conversation is now complete. To use another service or restart, please start a new conversation.`;

    return this.respondAndPersist(conversation, finalMessage, true);
  }

  // ========================================
  // Plugin Hook Execution
  // ========================================

  /**
   * Execute onStart hooks and validate merged data
   */
  private async executeOnStartHooks(
    conversation: Conversation,
    blueprint: ServiceBlueprint,
  ): Promise<void> {
    await this.pluginOrchestrator.executeOnStartHooks(conversation, blueprint);

    // Validate merged data against blueprint
    if (Object.keys(conversation.data).length > 0) {
      await this.conversationService.validateConversationData(
        conversation,
        blueprint,
      );
    }
  }

  /**
   * Execute onFieldValidated hooks and validate merged data
   */
  private async executeOnFieldValidatedHooks(
    conversation: Conversation,
    blueprint: ServiceBlueprint,
    fieldId: string,
    fieldValue: string | number | boolean | Date,
  ): Promise<void> {
    await this.pluginOrchestrator.executeOnFieldValidatedHooks(
      conversation,
      blueprint,
      fieldId,
      fieldValue,
    );

    // Validate merged data against blueprint
    await this.conversationService.validateConversationData(
      conversation,
      blueprint,
    );
  }

  // ========================================
  // Utility Methods
  // ========================================

  /**
   * Send welcome message for new conversation
   */
  private async sendWelcomeMessage(conversation: Conversation): Promise<void> {
    const availableServices = this.blueprintService.getAllBlueprints();
    const welcomeMessage =
      await this.presenterService.generateWelcomeMessage(availableServices);
    this.conversationService.appendMessage(conversation, 'ai', welcomeMessage);
  }

  /**
   * Get blueprint by ID
   */
  private getBlueprint(blueprintId: string): ServiceBlueprint {
    return this.blueprintService.getBlueprint(blueprintId);
  }

  /**
   * Get conversation history as LLM messages
   */
  private getHistory(conversation: Conversation): LlmMessage[] {
    return this.conversationService.getHistory(conversation);
  }

  /**
   * Find field in blueprint by ID
   */
  private findField(
    blueprint: ServiceBlueprint,
    fieldId: string,
  ): ServiceBlueprint['fields'][number] {
    const field = blueprint.fields.find((f) => f.id === fieldId);

    if (!field) {
      throw new Error(
        `Field '${fieldId}' not found in blueprint '${blueprint.id}'`,
      );
    }

    return field;
  }

  /**
   * Build standard conversation response
   */
  private buildResponse(
    conversation: Conversation,
    text: string,
    isComplete: boolean,
  ): ConversationResponse {
    return {
      conversationId: conversation.id,
      text,
      isComplete,
      data: conversation.data,
    };
  }

  /**
   * Respond, persist, and build response
   * Centralizes the common pattern of append + persist + build response
   */
  private async respondAndPersist(
    conversation: Conversation,
    responseText: string,
    isComplete: boolean,
  ): Promise<ConversationResponse> {
    this.conversationService.appendMessage(conversation, 'ai', responseText);
    await this.conversationService.persistConversation();

    return this.buildResponse(conversation, responseText, isComplete);
  }

  /**
   * Log non-answer intent for debugging
   */
  private logNonAnswerIntent(
    conversation: Conversation,
    intentClassification: { intent: string; reason?: string },
  ): void {
    const lastUserMessage =
      conversation.messages
        .slice()
        .reverse()
        .find((msg) => msg.role === 'user')?.content || '[unknown]';

    this.logger.log(
      `[${conversation.id}] Intent classified as ${intentClassification.intent}: "${lastUserMessage}" - Reason: ${intentClassification.reason}`,
    );
  }
}
