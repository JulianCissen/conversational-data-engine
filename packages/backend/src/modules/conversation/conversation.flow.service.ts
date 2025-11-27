import { Injectable, Logger } from '@nestjs/common';
import { Conversation } from './conversation.entity';
import { LlmMessage } from '../../core/llm/llm.types';
import { WorkflowService } from '../workflow/workflow.service';
import { InterpreterService } from '../intelligence/interpreter.service';
import { PresenterService } from '../intelligence/presenter.service';
import { ServiceBlueprint } from '../blueprint/interfaces/blueprint.interface';
import { BlueprintService } from '../blueprint/blueprint.service';
import { PluginManagerService } from '../../core/plugin/plugin.service';
import { ConversationService } from './conversation.service';
import { LanguageViolationException } from '../intelligence/intelligence.exceptions';

/**
 * ConversationFlowService
 *
 * Orchestrates the conversational flow by coordinating all services.
 * Acts as the state machine for conversations, handling:
 * - Service selection
 * - Intent classification
 * - Data extraction and validation
 * - Response generation
 * - Plugin hooks execution
 */
@Injectable()
export class ConversationFlowService {
  private readonly logger = new Logger(ConversationFlowService.name);

  constructor(
    private readonly conversationService: ConversationService,
    private readonly workflowService: WorkflowService,
    private readonly interpreterService: InterpreterService,
    private readonly presenterService: PresenterService,
    private readonly blueprintService: BlueprintService,
    private readonly pluginManagerService: PluginManagerService,
  ) {}

  /**
   * Main message handling logic - The Coordinator
   * Orchestrates the conversation flow by coordinating all services
   */
  async handleMessage(
    conversationId: string | undefined,
    userText: string,
  ): Promise<{
    conversationId: string;
    text: string;
    isComplete: boolean;
    data: Record<string, any>;
  }> {
    const conversation =
      await this.conversationService.getOrCreateConversation(conversationId);

    // Handle new conversation - store welcome message first
    if (!conversationId) {
      const welcomeMessage = this.presenterService.getWelcomeMessage();
      this.conversationService.appendMessage(
        conversation,
        'ai',
        welcomeMessage,
      );
    }

    // Append user message to history
    this.conversationService.appendMessage(conversation, 'user', userText);

    // Check if service has been selected
    if (!conversation.blueprintId) {
      return await this.handleServiceSelection(conversation, userText);
    }

    // Service is selected - proceed with normal blueprint flow
    return await this.handleBlueprintFlow(conversation, userText);
  }

  /**
   * Handle blueprint-based conversation flow
   */
  private async handleBlueprintFlow(
    conversation: Conversation,
    userText: string,
  ): Promise<{
    conversationId: string;
    text: string;
    isComplete: boolean;
    data: Record<string, any>;
  }> {
    const blueprint = this.blueprintService.getBlueprint(
      conversation.blueprintId!,
    );
    const languageConfig = blueprint.languageConfig;
    const history = this.conversationService.getHistory(conversation);

    // Determine user's intent
    const currentField = this.findFieldById(
      blueprint,
      conversation.currentFieldId!,
    );

    try {
      const intentClassification = await this.interpreterService.classifyIntent(
        userText,
        currentField,
        languageConfig,
        history,
      );

      // Branch based on intent
      if (intentClassification.intent === 'QUESTION') {
        return await this.handleClarificationQuestion(
          conversation,
          userText,
          currentField,
        );
      }

      // User is providing an answer
      return await this.handleAnswerProvision(
        conversation,
        userText,
        currentField,
        blueprint,
      );
    } catch (error) {
      if (error instanceof LanguageViolationException) {
        this.conversationService.appendMessage(
          conversation,
          'ai',
          error.message,
        );
        await this.conversationService.persistConversation();

        this.logger.log(
          `[collectField] Language violation - Expected: ${error.expectedLanguage}, User spoke: ${error.detectedLanguage}`,
        );

        return {
          conversationId: conversation.id,
          text: error.message,
          isComplete: false,
          data: conversation.data,
        };
      }
      throw error;
    }
  }

  /**
   * Handle service selection when user responds
   */
  private async handleServiceSelection(
    conversation: Conversation,
    userText: string,
  ): Promise<{
    conversationId: string;
    text: string;
    isComplete: boolean;
    data: Record<string, any>;
  }> {
    const availableServices = this.blueprintService.getAllBlueprints();
    const history = this.conversationService.getHistory(conversation);
    const selectionIntent =
      await this.interpreterService.classifyServiceSelection(
        userText,
        availableServices,
        history,
      );

    // User is asking for a list of services
    if (selectionIntent === 'LIST_SERVICES') {
      return await this.respondWithServiceList(conversation, availableServices);
    }

    // Intent is unclear
    if (selectionIntent === 'UNCLEAR') {
      return await this.respondWithUnclearSelection(conversation);
    }

    // Service was selected - update conversation and start blueprint flow
    conversation.blueprintId = selectionIntent;
    await this.conversationService.persistConversation();

    return await this.initializeNewConversation(conversation);
  }

  /**
   * Respond with service list
   */
  private async respondWithServiceList(
    conversation: Conversation,
    availableServices: ServiceBlueprint[],
  ): Promise<{
    conversationId: string;
    text: string;
    isComplete: boolean;
    data: Record<string, any>;
  }> {
    const responseText =
      this.presenterService.formatServiceList(availableServices);
    this.conversationService.appendMessage(conversation, 'ai', responseText);
    await this.conversationService.persistConversation();

    return {
      conversationId: conversation.id,
      text: responseText,
      isComplete: false,
      data: conversation.data,
    };
  }

  /**
   * Respond when service selection is unclear
   */
  private async respondWithUnclearSelection(
    conversation: Conversation,
  ): Promise<{
    conversationId: string;
    text: string;
    isComplete: boolean;
    data: Record<string, any>;
  }> {
    const responseText =
      this.presenterService.getServiceSelectionUnclearResponse();
    this.conversationService.appendMessage(conversation, 'ai', responseText);
    await this.conversationService.persistConversation();

    return {
      conversationId: conversation.id,
      text: responseText,
      isComplete: false,
      data: conversation.data,
    };
  }

  /**
   * Handle when the user is asking a clarifying question
   * Returns a contextual response without updating conversation state
   */
  private async handleClarificationQuestion(
    conversation: Conversation,
    userText: string,
    currentField: ServiceBlueprint['fields'][number],
  ): Promise<{
    conversationId: string;
    text: string;
    isComplete: boolean;
    data: Record<string, any>;
  }> {
    const blueprint = this.blueprintService.getBlueprint(
      conversation.blueprintId!,
    );
    const languageConfig = blueprint.languageConfig;
    const history = this.conversationService.getHistory(conversation);

    const responseText = await this.presenterService.generateContextualResponse(
      currentField,
      userText,
      languageConfig,
      history,
    );

    this.conversationService.appendMessage(conversation, 'ai', responseText);
    await this.conversationService.persistConversation();

    return {
      conversationId: conversation.id,
      text: responseText,
      isComplete: false,
      data: conversation.data,
    };
  }

  /**
   * Handle when the user is providing an answer
   * Extracts data, validates it, and progresses the conversation
   */
  private async handleAnswerProvision(
    conversation: Conversation,
    userText: string,
    currentField: ServiceBlueprint['fields'][number],
    blueprint: ServiceBlueprint,
  ): Promise<{
    conversationId: string;
    text: string;
    isComplete: boolean;
    data: Record<string, any>;
  }> {
    const languageConfig = blueprint.languageConfig;
    const history = this.conversationService.getHistory(conversation);

    // Extract and validate data
    const extractionResult = await this.extractAndValidateData(
      conversation,
      userText,
      currentField,
      languageConfig,
      history,
    );

    // Check if extraction failed (language violation or validation error)
    if (extractionResult.response) {
      return extractionResult.response;
    }

    // Update conversation data with validated field value
    conversation.data = {
      ...conversation.data,
      ...extractionResult.data,
    };

    // Execute field validated hooks
    await this.executeFieldValidatedHooks(
      conversation,
      blueprint,
      currentField,
      extractionResult.fieldValue!,
    );

    // Progress to next step
    return await this.progressConversation(conversation, blueprint);
  }

  /**
   * Extract data from user input and validate it
   */
  private async extractAndValidateData(
    conversation: Conversation,
    userText: string,
    currentField: ServiceBlueprint['fields'][number],
    languageConfig: ServiceBlueprint['languageConfig'],
    history: LlmMessage[],
  ): Promise<{
    response?: {
      conversationId: string;
      text: string;
      isComplete: boolean;
      data: Record<string, any>;
    };
    data?: Record<string, any>;
    fieldValue?: string | number | boolean | Date;
  }> {
    try {
      // Extract data from user's message
      const extractionResult = await this.interpreterService.extractData(
        [currentField],
        userText,
        languageConfig,
        history,
      );

      // Update current language if detected
      if (
        extractionResult.userMessageLanguage &&
        !conversation.currentLanguage
      ) {
        conversation.currentLanguage = extractionResult.userMessageLanguage;
        this.logger.log(
          `[extractAndValidateData] Detected user language: ${extractionResult.userMessageLanguage}`,
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

      // Validate the extracted data
      const isValid = this.workflowService.validateValue(
        fieldValue,
        currentField,
      );

      this.logger.debug(
        `[extractAndValidateData] Validation for '${currentField.id}': ${isValid ? 'PASS' : 'FAIL'}`,
      );

      // If invalid, generate error response
      if (!isValid) {
        this.logger.debug(
          `[extractAndValidateData] Validation failed - Expected: ${JSON.stringify(currentField.validation)}, Received: ${JSON.stringify(fieldValue)}`,
        );

        const errorResponse = await this.presenterService.generateErrorResponse(
          currentField,
          userText,
          undefined,
          languageConfig,
          history,
        );

        this.conversationService.appendMessage(
          conversation,
          'ai',
          errorResponse,
        );
        await this.conversationService.persistConversation();

        return {
          response: {
            conversationId: conversation.id,
            text: errorResponse,
            isComplete: false,
            data: conversation.data,
          },
        };
      }

      this.logger.log(
        `[extractAndValidateData] Validation passed, data ready for update`,
      );

      return {
        data: extractedData,
        fieldValue,
      };
    } catch (error) {
      if (error instanceof LanguageViolationException) {
        // Handle language violation
        this.conversationService.appendMessage(
          conversation,
          'ai',
          error.message,
        );
        await this.conversationService.persistConversation();

        this.logger.log(
          `[extractAndValidateData] Language violation - Expected: ${error.expectedLanguage}, User spoke: ${error.detectedLanguage}`,
        );

        return {
          response: {
            conversationId: conversation.id,
            text: error.message,
            isComplete: false,
            data: conversation.data,
          },
        };
      }
      // Re-throw other errors
      throw error;
    }
  }

  /**
   * Execute onFieldValidated hooks
   */
  private async executeFieldValidatedHooks(
    conversation: Conversation,
    blueprint: ServiceBlueprint,
    currentField: ServiceBlueprint['fields'][number],
    fieldValue: string | number | boolean | Date,
  ): Promise<void> {
    if (
      !blueprint.hooks.onFieldValidated ||
      blueprint.hooks.onFieldValidated.length === 0
    ) {
      return;
    }

    const pluginResult = await this.pluginManagerService.executeFieldValidated(
      blueprint.hooks.onFieldValidated,
      {
        serviceId: blueprint.id,
        conversationId: conversation.id,
        data: conversation.data,
        fieldId: currentField.id,
        fieldValue: fieldValue,
        config: this.getPluginConfig(
          blueprint,
          blueprint.hooks.onFieldValidated[0],
        ),
      },
      blueprint,
    );

    // Merge slot updates from plugins
    if (
      pluginResult.slotUpdates &&
      Object.keys(pluginResult.slotUpdates).length > 0
    ) {
      conversation.data = {
        ...conversation.data,
        ...pluginResult.slotUpdates,
      };

      // Validate merged data against blueprint
      await this.conversationService.validateConversationData(
        conversation,
        blueprint,
      );
    }
  }

  /**
   * Progress conversation to next step
   */
  private async progressConversation(
    conversation: Conversation,
    blueprint: ServiceBlueprint,
  ): Promise<{
    conversationId: string;
    text: string;
    isComplete: boolean;
    data: Record<string, any>;
  }> {
    // Determine next step and update conversation state
    const nextStep = await this.updateConversationState(
      conversation,
      blueprint,
    );

    // If conversation is complete, execute onConversationComplete hooks
    if (nextStep.isComplete) {
      await this.executeConversationCompleteHooks(conversation, blueprint);
    }

    // Generate appropriate response
    const responseText = await this.generateResponse(
      nextStep,
      blueprint,
      conversation,
    );

    this.conversationService.appendMessage(conversation, 'ai', responseText);
    await this.conversationService.persistConversation();

    return {
      conversationId: conversation.id,
      text: responseText,
      isComplete: nextStep.isComplete,
      data: conversation.data,
    };
  }

  /**
   * Execute onConversationComplete hooks
   */
  private async executeConversationCompleteHooks(
    conversation: Conversation,
    blueprint: ServiceBlueprint,
  ): Promise<void> {
    if (
      !blueprint.hooks.onConversationComplete ||
      blueprint.hooks.onConversationComplete.length === 0
    ) {
      return;
    }

    await this.pluginManagerService.executeConversationComplete(
      blueprint.hooks.onConversationComplete,
      {
        serviceId: blueprint.id,
        conversationId: conversation.id,
        data: conversation.data,
        config: this.getPluginConfig(
          blueprint,
          blueprint.hooks.onConversationComplete[0],
        ),
      },
      blueprint,
    );
  }

  /**
   * Initialize a new conversation by generating the first question
   */
  private async initializeNewConversation(conversation: Conversation): Promise<{
    conversationId: string;
    text: string;
    isComplete: boolean;
    data: Record<string, any>;
  }> {
    if (!conversation.blueprintId) {
      throw new Error(
        'Cannot initialize conversation without a selected blueprint',
      );
    }

    const blueprint = this.blueprintService.getBlueprint(
      conversation.blueprintId,
    );
    const languageConfig = blueprint.languageConfig;

    // Announce language requirement if strict mode
    if (languageConfig?.mode === 'strict') {
      const languageAnnouncement =
        await this.presenterService.getLanguageRequirementAnnouncement(
          languageConfig.defaultLanguage,
        );
      this.conversationService.appendMessage(
        conversation,
        'ai',
        languageAnnouncement,
      );
    }

    // Execute onStart hooks
    await this.executeStartHooks(conversation, blueprint);

    // Determine and ask first question
    return await this.askFirstQuestion(conversation, blueprint);
  }

  /**
   * Execute onStart hooks
   */
  private async executeStartHooks(
    conversation: Conversation,
    blueprint: ServiceBlueprint,
  ): Promise<void> {
    if (!blueprint.hooks.onStart || blueprint.hooks.onStart.length === 0) {
      return;
    }

    const pluginResult = await this.pluginManagerService.executeStart(
      blueprint.hooks.onStart,
      {
        serviceId: blueprint.id,
        conversationId: conversation.id,
        data: conversation.data,
        config: this.getPluginConfig(blueprint, blueprint.hooks.onStart[0]),
      },
      blueprint,
    );

    // Merge slot updates from plugins
    if (
      pluginResult.slotUpdates &&
      Object.keys(pluginResult.slotUpdates).length > 0
    ) {
      conversation.data = {
        ...conversation.data,
        ...pluginResult.slotUpdates,
      };

      // Validate merged data against blueprint
      await this.conversationService.validateConversationData(
        conversation,
        blueprint,
      );
    }
  }

  /**
   * Ask the first question in the conversation
   */
  private async askFirstQuestion(
    conversation: Conversation,
    blueprint: ServiceBlueprint,
  ): Promise<{
    conversationId: string;
    text: string;
    isComplete: boolean;
    data: Record<string, any>;
  }> {
    const nextStep = this.workflowService.determineNextStep(
      blueprint,
      conversation.data,
    );

    if (!nextStep.nextFieldId) {
      throw new Error(
        'Unable to initialize conversation: no starting field found',
      );
    }

    conversation.currentFieldId = nextStep.nextFieldId;

    const field = this.findFieldById(blueprint, nextStep.nextFieldId);
    const history = this.conversationService.getHistory(conversation);
    const questionText = await this.presenterService.generateQuestion(
      field,
      blueprint.languageConfig,
      history,
    );

    this.conversationService.appendMessage(conversation, 'ai', questionText);
    await this.conversationService.persistConversation();

    return {
      conversationId: conversation.id,
      text: questionText,
      isComplete: false,
      data: conversation.data,
    };
  }

  /**
   * Determine next step and update conversation state
   */
  private async updateConversationState(
    conversation: Conversation,
    blueprint: ServiceBlueprint,
  ): Promise<{
    isComplete: boolean;
    nextFieldId: string | null;
  }> {
    const nextStep = this.workflowService.determineNextStep(
      blueprint,
      conversation.data,
    );

    conversation.currentFieldId = nextStep.nextFieldId ?? undefined;

    if (nextStep.isComplete) {
      conversation.status = 'COMPLETED';
    }

    await this.conversationService.persistConversation();

    return nextStep;
  }

  /**
   * Generate appropriate response based on conversation state
   */
  private async generateResponse(
    nextStep: {
      isComplete: boolean;
      nextFieldId: string | null;
    },
    blueprint: ServiceBlueprint,
    conversation: Conversation,
  ): Promise<string> {
    if (nextStep.isComplete) {
      return this.presenterService.getCompletionMessage();
    }

    if (nextStep.nextFieldId) {
      const nextField = this.findFieldById(blueprint, nextStep.nextFieldId);
      const languageConfig = blueprint.languageConfig;
      const history = this.conversationService.getHistory(conversation);
      return await this.presenterService.generateQuestion(
        nextField,
        languageConfig,
        history,
      );
    }

    return this.presenterService.getFallbackMessage();
  }

  /**
   * Find a field in the blueprint by ID
   */
  private findFieldById(
    blueprint: ServiceBlueprint,
    fieldId: string,
  ): ServiceBlueprint['fields'][number] {
    const field = blueprint.fields.find((f) => f.id === fieldId);

    if (!field) {
      throw new Error(`Field not found in blueprint: ${fieldId}`);
    }

    return field;
  }

  /**
   * Get plugin configuration for a specific plugin instance ID from the blueprint
   */
  private getPluginConfig(
    blueprint: ServiceBlueprint,
    instanceId: string,
  ): Record<string, any> {
    const plugin = blueprint.plugins.find(
      (p) => (p.instanceId || p.id) === instanceId,
    );
    return plugin?.config || {};
  }
}
