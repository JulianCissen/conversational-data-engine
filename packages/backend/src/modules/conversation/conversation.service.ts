import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityManager, EntityRepository } from '@mikro-orm/core';
import { Conversation } from './conversation.entity';
import { WorkflowService } from '../workflow/workflow.service';
import { InterpreterService } from '../intelligence/interpreter.service';
import { PresenterService } from '../intelligence/presenter.service';
import { ServiceBlueprint } from '../blueprint/interfaces/blueprint.interface';
import { BlueprintService } from '../blueprint/blueprint.service';

@Injectable()
export class ConversationService {
  constructor(
    @InjectRepository(Conversation)
    private readonly conversationRepository: EntityRepository<Conversation>,
    private readonly em: EntityManager,
    private readonly workflowService: WorkflowService,
    private readonly interpreterService: InterpreterService,
    private readonly presenterService: PresenterService,
    private readonly blueprintService: BlueprintService,
  ) {}

  /**
   * Main message handling logic - The Coordinator
   * Orchestrates the conversation flow by coordinating all services
   */
  async handleMessage(
    conversationId: string | undefined,
    userText: string,
  ): Promise<{ conversationId: string; text: string; isComplete: boolean; data: Record<string, any> }> {
    const conversation = await this.getOrCreateConversation(conversationId);
    
    // Handle new conversation initialization with service selection
    if (!conversationId) {
      return await this.initializeServiceSelection(conversation);
    }

    // Check if service has been selected
    if (!conversation.blueprintId) {
      // User is in service selection phase
      return await this.handleServiceSelection(conversation, userText);
    }

    // Service is selected - proceed with normal blueprint flow
    const blueprint = this.blueprintService.getBlueprint(conversation.blueprintId);
    
    // Determine user's intent
    const currentField = this.findFieldById(blueprint, conversation.currentFieldId!);
    const intent = await this.interpreterService.classifyIntent(userText, currentField);
    
    // Branch based on intent
    if (intent === 'QUESTION') {
      return await this.handleClarificationQuestion(conversation, userText, currentField);
    }
    
    // User is providing an answer - extract and validate
    return await this.handleAnswerProvision(conversation, userText, currentField, blueprint);
  }

  /**
   * Initialize service selection for a new conversation
   */
  private async initializeServiceSelection(
    conversation: Conversation,
  ): Promise<{ conversationId: string; text: string; isComplete: boolean; data: Record<string, any> }> {
    const welcomeMessage = this.presenterService.getWelcomeMessage();
    
    return {
      conversationId: conversation.id,
      text: welcomeMessage,
      isComplete: false,
      data: conversation.data,
    };
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
    const responseText = await this.presenterService.generateContextualResponse(
      currentField,
      userText,
    );
    
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
    // Extract data from user's message
    const extractedData = await this.interpreterService.extractData(
      [currentField],
      userText,
    );
    
    // Validate the extracted data
    const fieldValue = extractedData[currentField.id];
    const isValid = this.workflowService.validateValue(fieldValue, currentField);
    
    // If invalid, generate error response and re-ask
    if (!isValid) {
      const errorResponse = await this.presenterService.generateErrorResponse(
        currentField,
        userText,
      );
      
      return {
        conversationId: conversation.id,
        text: errorResponse,
        isComplete: false,
        data: conversation.data,
      };
    }
    
    // Valid data - update conversation
    conversation.data = {
      ...conversation.data,
      ...extractedData,
    };
    
    // Determine next step and update conversation state
    const nextStep = await this.updateConversationState(conversation, blueprint);
    
    // Generate appropriate response
    const responseText = await this.generateResponse(nextStep, blueprint);

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
    const nextStep = this.workflowService.determineNextStep(
      blueprint,
      conversation.data,
    );
    
    if (nextStep.nextFieldId) {
      conversation.currentFieldId = nextStep.nextFieldId;
      await this.em.flush();
      
      const field = this.findFieldById(blueprint, nextStep.nextFieldId);
      const questionText = await this.presenterService.generateQuestion(field);
      
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
      return await this.presenterService.generateQuestion(nextField);
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
}
