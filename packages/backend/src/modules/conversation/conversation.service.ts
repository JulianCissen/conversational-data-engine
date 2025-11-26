import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityManager, EntityRepository } from '@mikro-orm/core';
import { Conversation, Message } from './conversation.entity';
import { WorkflowService } from '../workflow/workflow.service';
import { InterpreterService } from '../intelligence/interpreter.service';
import { PresenterService } from '../intelligence/presenter.service';
import { ServiceBlueprint } from '../blueprint/interfaces/blueprint.interface';
import { BlueprintService } from '../blueprint/blueprint.service';
import { PluginManagerService } from '../../core/plugin/plugin.service';

@Injectable()
export class ConversationService {
  private readonly logger = new Logger(ConversationService.name);

  constructor(
    @InjectRepository(Conversation)
    private readonly conversationRepository: EntityRepository<Conversation>,
    private readonly em: EntityManager,
    private readonly workflowService: WorkflowService,
    private readonly interpreterService: InterpreterService,
    private readonly presenterService: PresenterService,
    private readonly blueprintService: BlueprintService,
    private readonly pluginManagerService: PluginManagerService,
  ) {
    // Set the static BlueprintService reference for the entity getter
    Conversation.setBlueprintService(this.blueprintService);
  }

  /**
   * Get configuration including welcome message
   */
  async getConfig(): Promise<{ welcomeMessage: string }> {
    const welcomeMessage = this.presenterService.getWelcomeMessage();
    return { welcomeMessage };
  }

  /**
   * Main message handling logic - The Coordinator
   * Orchestrates the conversation flow by coordinating all services
   */
  async handleMessage(
    conversationId: string | undefined,
    userText: string,
  ): Promise<{ conversationId: string; text: string; isComplete: boolean; data: Record<string, any> }> {
    const conversation = await this.getOrCreateConversation(conversationId);
    
    // Handle new conversation - store welcome message first
    if (!conversationId) {
      const welcomeMessage = this.presenterService.getWelcomeMessage();
      this.appendMessage(conversation, 'system', welcomeMessage);
    }

    // Append user message to history
    this.appendMessage(conversation, 'user', userText);

    // Check if service has been selected
    if (!conversation.blueprintId) {
      // User is in service selection phase
      return await this.handleServiceSelection(conversation, userText);
    }

    // Service is selected - proceed with normal blueprint flow
    const blueprint = this.blueprintService.getBlueprint(conversation.blueprintId);
    const languageConfig = blueprint.languageConfig;
    
    // Determine user's intent
    const currentField = this.findFieldById(blueprint, conversation.currentFieldId!);
    const intentClassification = await this.interpreterService.classifyIntent(
      userText,
      currentField,
      languageConfig,
    );
    
    // Check for language violations first (applies to all intents in strict mode)
    if (intentClassification.isLanguageViolation) {
      const violationMessage = intentClassification.languageViolationMessage || 
        `Please communicate in ${languageConfig?.defaultLanguage} only.`;
      
      this.appendMessage(conversation, 'system', violationMessage);
      await this.em.flush();
      
      this.logger.log(
        `[handleMessage] Language violation detected during intent classification`,
      );
      
      return {
        conversationId: conversation.id,
        text: violationMessage,
        isComplete: false,
        data: conversation.data,
      };
    }
    
    // Branch based on intent
    if (intentClassification.intent === 'QUESTION') {
      return await this.handleClarificationQuestion(conversation, userText, currentField);
    }
    
    // User is providing an answer - extract and validate
    return await this.handleAnswerProvision(conversation, userText, currentField, blueprint);
  }

  /**
   * Handle service selection when user responds
   */
  private async handleServiceSelection(
    conversation: Conversation,
    userText: string,
  ): Promise<{ conversationId: string; text: string; isComplete: boolean; data: Record<string, any> }> {
    const availableServices = this.blueprintService.getAllBlueprints();
    const selectionIntent = await this.interpreterService.classifyServiceSelection(
      userText,
      availableServices,
    );

    // User is asking for a list of services
    if (selectionIntent === 'LIST_SERVICES') {
      const responseText = this.presenterService.formatServiceList(availableServices);
      this.appendMessage(conversation, 'system', responseText);
      await this.em.flush();
      
      return {
        conversationId: conversation.id,
        text: responseText,
        isComplete: false,
        data: conversation.data,
      };
    }

    // Intent is unclear
    if (selectionIntent === 'UNCLEAR') {
      const responseText = this.presenterService.getServiceSelectionUnclearResponse();
      this.appendMessage(conversation, 'system', responseText);
      await this.em.flush();
      
      return {
        conversationId: conversation.id,
        text: responseText,
        isComplete: false,
        data: conversation.data,
      };
    }

    // Service was selected - update conversation and start blueprint flow
    conversation.blueprintId = selectionIntent;
    await this.em.flush();
    
    return await this.initializeNewConversation(conversation);
  }

  /**
   * Handle when the user is asking a clarifying question
   * Returns a contextual response without updating conversation state
   */
  private async handleClarificationQuestion(
    conversation: Conversation,
    userText: string,
    currentField: any,
  ): Promise<{ conversationId: string; text: string; isComplete: boolean; data: Record<string, any> }> {
    const blueprint = this.blueprintService.getBlueprint(conversation.blueprintId!);
    const languageConfig = blueprint.languageConfig;
    
    const responseText = await this.presenterService.generateContextualResponse(
      currentField,
      userText,
      languageConfig,
    );
    
    this.appendMessage(conversation, 'system', responseText);
    await this.em.flush();
    
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
    currentField: any,
    blueprint: ServiceBlueprint,
  ): Promise<{ conversationId: string; text: string; isComplete: boolean; data: Record<string, any> }> {
    const languageConfig = blueprint.languageConfig;
    
    // Extract data from user's message
    const extractionResult = await this.interpreterService.extractData(
      [currentField],
      userText,
      languageConfig,
      conversation.currentLanguage,
    );
    
    // Check for language violations first
    if (extractionResult.isLanguageViolation) {
      const violationMessage = extractionResult.languageViolationMessage || 
        `Please communicate in ${languageConfig?.defaultLanguage} only.`;
      
      this.appendMessage(conversation, 'system', violationMessage);
      await this.em.flush();
      
      this.logger.log(
        `[handleAnswerProvision] Language violation detected - Expected: ${languageConfig?.defaultLanguage}, User spoke: ${extractionResult.userMessageLanguage}`,
      );
      
      return {
        conversationId: conversation.id,
        text: violationMessage,
        isComplete: false,
        data: conversation.data,
      };
    }
    
    // Update current language if detected (for adaptive mode or first message)
    if (extractionResult.userMessageLanguage && !conversation.currentLanguage) {
      conversation.currentLanguage = extractionResult.userMessageLanguage;
      this.logger.log(
        `[handleAnswerProvision] Detected user language: ${extractionResult.userMessageLanguage}`,
      );
    }
    
    const extractedData = extractionResult.data;
    
    // Validate the extracted data
    const fieldValue = extractedData[currentField.id];
    
    const isValid = this.workflowService.validateValue(fieldValue, currentField);
    this.logger.debug(`[handleAnswerProvision] Validation for '${currentField.id}': ${isValid ? 'PASS' : 'FAIL'}`);
    
    // If invalid, generate error response and re-ask
    if (!isValid) {
      this.logger.debug(
        `[handleAnswerProvision] Validation failed - Expected: ${JSON.stringify(currentField.validation)}, Received: ${JSON.stringify(fieldValue)}`,
      );
      
      const errorResponse = await this.presenterService.generateErrorResponse(
        currentField,
        userText,
        undefined,
        languageConfig,
      );
      
      this.appendMessage(conversation, 'system', errorResponse);
      await this.em.flush();
      
      return {
        conversationId: conversation.id,
        text: errorResponse,
        isComplete: false,
        data: conversation.data,
      };
    }
    
    this.logger.log(`[handleAnswerProvision] Validation passed, updating conversation data`);
    
    // Valid data - update conversation
    conversation.data = {
      ...conversation.data,
      ...extractedData,
    };
    
    // Execute onFieldValidated hooks
    if (blueprint.hooks.onFieldValidated && blueprint.hooks.onFieldValidated.length > 0) {
      const pluginResult = await this.pluginManagerService.executeFieldValidated(
        blueprint.hooks.onFieldValidated,
        {
          serviceId: blueprint.id,
          conversationId: conversation.id,
          data: conversation.data,
          fieldId: currentField.id,
          fieldValue: fieldValue,
          config: this.getPluginConfig(blueprint, blueprint.hooks.onFieldValidated[0]),
        },
        blueprint,
      );
      
      // Merge slot updates from plugins
      if (pluginResult.slotUpdates && Object.keys(pluginResult.slotUpdates).length > 0) {
        conversation.data = {
          ...conversation.data,
          ...pluginResult.slotUpdates,
        };
        
        // Validate merged data against blueprint
        await this.validateConversationData(conversation, blueprint);
      }
    }
    
    // Determine next step and update conversation state
    const nextStep = await this.updateConversationState(conversation, blueprint);
    
    // If conversation is complete, execute onConversationComplete hooks
    if (nextStep.isComplete && blueprint.hooks.onConversationComplete && blueprint.hooks.onConversationComplete.length > 0) {
      await this.pluginManagerService.executeConversationComplete(
        blueprint.hooks.onConversationComplete,
        {
          serviceId: blueprint.id,
          conversationId: conversation.id,
          data: conversation.data,
          config: this.getPluginConfig(blueprint, blueprint.hooks.onConversationComplete[0]),
        },
        blueprint,
      );
    }
    
    // Generate appropriate response
    const responseText = await this.generateResponse(nextStep, blueprint);

    this.appendMessage(conversation, 'system', responseText);
    await this.em.flush();

    return {
      conversationId: conversation.id,
      text: responseText,
      isComplete: nextStep.isComplete,
      data: conversation.data,
    };
  }

  /**
   * Load existing conversation or create a new one
   */
  private async getOrCreateConversation(conversationId: string | undefined): Promise<Conversation> {
    if (conversationId) {
      const foundConversation = await this.conversationRepository.findOne({ id: conversationId });
      if (!foundConversation) {
        throw new Error('Conversation not found');
      }
      return foundConversation;
    }
    
    const conversation = new Conversation();
    await this.em.persistAndFlush(conversation);
    return conversation;
  }

  /**
   * Initialize a new conversation by generating the first question
   */
  private async initializeNewConversation(
    conversation: Conversation,
  ): Promise<{ conversationId: string; text: string; isComplete: boolean; data: Record<string, any> }> {
    if (!conversation.blueprintId) {
      throw new Error('Cannot initialize conversation without a selected blueprint');
    }

    const blueprint = this.blueprintService.getBlueprint(conversation.blueprintId);
    const languageConfig = blueprint.languageConfig;
    
    // If strict language mode, announce the language requirement first
    if (languageConfig?.mode === 'strict') {
      const languageAnnouncement = await this.presenterService.getLanguageRequirementAnnouncement(
        languageConfig.defaultLanguage,
      );
      this.appendMessage(conversation, 'system', languageAnnouncement);
    }
    
    // Execute onStart hooks
    if (blueprint.hooks.onStart && blueprint.hooks.onStart.length > 0) {
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
      if (pluginResult.slotUpdates && Object.keys(pluginResult.slotUpdates).length > 0) {
        conversation.data = {
          ...conversation.data,
          ...pluginResult.slotUpdates,
        };
        
        // Validate merged data against blueprint
        await this.validateConversationData(conversation, blueprint);
      }
    }
    
    const nextStep = this.workflowService.determineNextStep(
      blueprint,
      conversation.data,
    );
    
    if (nextStep.nextFieldId) {
      conversation.currentFieldId = nextStep.nextFieldId;
      
      const field = this.findFieldById(blueprint, nextStep.nextFieldId);
      const questionText = await this.presenterService.generateQuestion(field, languageConfig);
      
      this.appendMessage(conversation, 'system', questionText);
      await this.em.flush();
      
      return {
        conversationId: conversation.id,
        text: questionText,
        isComplete: false,
        data: conversation.data,
      };
    }
    
    throw new Error('Unable to initialize conversation: no starting field found');
  }

  /**
   * Determine next step and update conversation state
   */
  private async updateConversationState(conversation: Conversation, blueprint: ServiceBlueprint): Promise<{
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
    
    await this.em.flush();
    
    return nextStep;
  }

  /**
   * Generate appropriate response based on conversation state
   */
  private async generateResponse(nextStep: {
    isComplete: boolean;
    nextFieldId: string | null;
  }, blueprint: ServiceBlueprint): Promise<string> {
    if (nextStep.isComplete) {
      return this.presenterService.getCompletionMessage();
    }
    
    if (nextStep.nextFieldId) {
      const nextField = this.findFieldById(blueprint, nextStep.nextFieldId);
      const languageConfig = blueprint.languageConfig;
      return await this.presenterService.generateQuestion(nextField, languageConfig);
    }
    
    return this.presenterService.getFallbackMessage();
  }

  /**
   * Find a field in the blueprint by ID
   */
  private findFieldById(blueprint: ServiceBlueprint, fieldId: string) {
    const field = blueprint.fields.find((f) => f.id === fieldId);
    
    if (!field) {
      throw new Error(`Field not found in blueprint: ${fieldId}`);
    }
    
    return field;
  }

  /**
   * Append a message to the conversation history
   */
  private appendMessage(conversation: Conversation, role: 'user' | 'system', content: string): void {
    conversation.messages.push({
      role,
      content,
      timestamp: new Date(),
    });
  }

  /**
   * Get plugin configuration for a specific plugin instance ID from the blueprint
   */
  private getPluginConfig(blueprint: ServiceBlueprint, instanceId: string): Record<string, any> {
    const plugin = blueprint.plugins.find((p) => (p.instanceId || p.id) === instanceId);
    return plugin?.config || {};
  }

  /**
   * Validate conversation data against blueprint schema.
   * Throws an error if validation fails.
   */
  private async validateConversationData(conversation: Conversation, blueprint: ServiceBlueprint): Promise<void> {
    for (const [key, value] of Object.entries(conversation.data)) {
      const field = blueprint.fields.find((f) => f.id === key);
      if (field) {
        const isValid = this.workflowService.validateValue(value, field);
        if (!isValid) {
          throw new Error(`Plugin slot update validation failed for field: ${key}`);
        }
      }
    }
  }

  /**
   * Get all conversations
   */
  async findAll(): Promise<Conversation[]> {
    return await this.conversationRepository.findAll({
      orderBy: { updatedAt: 'DESC' },
    });
  }

  /**
   * Get a single conversation by ID
   */
  async findOne(id: string): Promise<Conversation> {
    const conversation = await this.conversationRepository.findOne({ id });
    if (!conversation) {
      throw new Error('Conversation not found');
    }
    return conversation;
  }

  /**
   * Delete a conversation by ID
   */
  async remove(id: string): Promise<void> {
    const conversation = await this.conversationRepository.findOne({ id });
    if (!conversation) {
      throw new Error('Conversation not found');
    }
    await this.em.removeAndFlush(conversation);
  }
}
