import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityManager, EntityRepository } from '@mikro-orm/core';
import { Session } from '../session/session.entity';
import { OrchestratorService } from '../orchestrator/orchestrator.service';
import { ExtractionService } from '../extraction/extraction.service';
import { GenerationService } from '../generation/generation.service';
import { IntentService } from '../intent/intent.service';
import { ServiceBlueprint } from '../blueprint/interfaces/blueprint.interface';
import * as sampleBlueprint from '../blueprint/data/sample-travel.json';

@Injectable()
export class ChatService {
  // Load the blueprint (in production, this would come from a database)
  private readonly blueprint: ServiceBlueprint = sampleBlueprint as ServiceBlueprint;

  constructor(
    @InjectRepository(Session)
    private readonly sessionRepository: EntityRepository<Session>,
    private readonly em: EntityManager,
    private readonly orchestratorService: OrchestratorService,
    private readonly extractionService: ExtractionService,
    private readonly generationService: GenerationService,
    private readonly intentService: IntentService,
  ) {}

  /**
   * Main message handling logic - The Coordinator
   * Orchestrates the conversation flow by coordinating all services
   */
  async handleMessage(
    sessionId: string | undefined,
    userText: string,
  ): Promise<{ sessionId: string; text: string; isComplete: boolean }> {
    const session = await this.getOrCreateSession(sessionId);
    
    // Handle new session initialization
    if (!sessionId) {
      return await this.initializeNewSession(session);
    }

    // Determine user's intent
    const currentField = this.findFieldById(session.currentFieldId!);
    const intent = await this.intentService.classifyIntent(userText, currentField);
    
    // Branch based on intent
    if (intent === 'QUESTION') {
      return await this.handleClarificationQuestion(session, userText, currentField);
    }
    
    // User is providing an answer - extract and validate
    return await this.handleAnswerProvision(session, userText, currentField);
  }

  /**
   * Handle when the user is asking a clarifying question
   * Returns a contextual response without updating session state
   */
  private async handleClarificationQuestion(
    session: Session,
    userText: string,
    currentField: any,
  ): Promise<{ sessionId: string; text: string; isComplete: boolean }> {
    const responseText = await this.generationService.generateContextualResponse(
      currentField,
      userText,
    );
    
    return {
      sessionId: session.id,
      text: responseText,
      isComplete: false,
    };
  }

  /**
   * Handle when the user is providing an answer
   * Extracts data, validates it, and progresses the conversation
   */
  private async handleAnswerProvision(
    session: Session,
    userText: string,
    currentField: any,
  ): Promise<{ sessionId: string; text: string; isComplete: boolean }> {
    // Extract data from user's message
    const extractedData = await this.extractionService.extractData(
      [currentField],
      userText,
    );
    
    // Validate the extracted data
    const fieldValue = extractedData[currentField.id];
    const isValid = this.validateFieldData(fieldValue, currentField);
    
    // If invalid, generate error response and re-ask
    if (!isValid) {
      const errorResponse = await this.generationService.generateErrorResponse(
        currentField,
        userText,
        'The provided value is missing or does not match the expected format.',
      );
      
      return {
        sessionId: session.id,
        text: errorResponse,
        isComplete: false,
      };
    }
    
    // Valid data - update session
    session.data = {
      ...session.data,
      ...extractedData,
    };
    
    // Determine next step and update session state
    const nextStep = await this.updateSessionState(session);
    
    // Generate appropriate response
    const responseText = await this.generateResponse(nextStep);

    return {
      sessionId: session.id,
      text: responseText,
      isComplete: nextStep.isComplete,
    };
  }

  /**
   * Validate extracted field data
   * For MVP, this is a simple null/undefined check
   * TODO: Implement full JSON Schema validation using Zod
   */
  private validateFieldData(value: any, field: any): boolean {
    // Basic validation: check if value exists
    if (value === null || value === undefined || value === '') {
      return false;
    }
    
    // Type-specific validation
    if (field.type === 'number' && typeof value !== 'number') {
      return false;
    }
    
    if (field.type === 'boolean' && typeof value !== 'boolean') {
      return false;
    }
    
    // TODO: Add JSON Schema validation here
    return true;
  }

  /**
   * Load existing session or create a new one
   */
  private async getOrCreateSession(sessionId: string | undefined): Promise<Session> {
    if (sessionId) {
      const foundSession = await this.sessionRepository.findOne({ id: sessionId });
      if (!foundSession) {
        throw new Error('Session not found');
      }
      return foundSession;
    }
    
    const session = new Session();
    await this.em.persistAndFlush(session);
    return session;
  }

  /**
   * Initialize a new session by generating the first question
   */
  private async initializeNewSession(
    session: Session,
  ): Promise<{ sessionId: string; text: string; isComplete: boolean }> {
    const nextStep = this.orchestratorService.determineNextStep(
      this.blueprint,
      session.data,
    );
    
    if (nextStep.nextFieldId) {
      session.currentFieldId = nextStep.nextFieldId;
      await this.em.flush();
      
      const field = this.findFieldById(nextStep.nextFieldId);
      const questionText = await this.generationService.generateQuestion(field);
      
      return {
        sessionId: session.id,
        text: questionText,
        isComplete: false,
      };
    }
    
    throw new Error('Unable to initialize session: no starting field found');
  }

  /**
   * Determine next step and update session state
   */
  private async updateSessionState(session: Session): Promise<{
    isComplete: boolean;
    nextFieldId: string | null;
  }> {
    const nextStep = this.orchestratorService.determineNextStep(
      this.blueprint,
      session.data,
    );
    
    session.currentFieldId = nextStep.nextFieldId ?? undefined;
    
    if (nextStep.isComplete) {
      session.status = 'COMPLETED';
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
  }): Promise<string> {
    if (nextStep.isComplete) {
      return 'Thank you! I have collected all the necessary information. Your request has been completed.';
    }
    
    if (nextStep.nextFieldId) {
      const nextField = this.findFieldById(nextStep.nextFieldId);
      return await this.generationService.generateQuestion(nextField);
    }
    
    return 'I\'m not sure what to ask next.';
  }

  /**
   * Find a field in the blueprint by ID
   */
  private findFieldById(fieldId: string) {
    const field = this.blueprint.fields.find((f) => f.id === fieldId);
    
    if (!field) {
      throw new Error(`Field not found in blueprint: ${fieldId}`);
    }
    
    return field;
  }
}
