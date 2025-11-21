import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityManager, EntityRepository } from '@mikro-orm/core';
import { Session } from '../session/session.entity';
import { OrchestratorService } from '../orchestrator/orchestrator.service';
import { ExtractionService } from '../extraction/extraction.service';
import { GenerationService } from '../generation/generation.service';
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
  ) {}

  /**
   * Main message handling logic - The Coordinator
   * Orchestrates the conversation flow by coordinating all services
   */
  async handleMessage(
    sessionId: string | undefined,
    userText: string,
  ): Promise<{ sessionId: string; text: string; isComplete: boolean }> {
    // Step 1: Load or create session
    let session: Session;
    
    if (sessionId) {
      // Load existing session
      const foundSession = await this.sessionRepository.findOne({ id: sessionId });
      if (!foundSession) {
        throw new Error('Session not found');
      }
      session = foundSession;
    } else {
      // Create new session
      session = new Session();
      await this.em.persistAndFlush(session);
      
      // For new sessions, generate the first question
      const nextStep = this.orchestratorService.determineNextStep(
        this.blueprint,
        session.data,
      );
      
      if (nextStep.nextFieldId) {
        session.currentFieldId = nextStep.nextFieldId;
        await this.em.flush();
        
        const field = this.blueprint.fields.find(
          (f) => f.id === nextStep.nextFieldId,
        );
        
        if (!field) {
          throw new Error('Field not found in blueprint');
        }
        
        const questionText = await this.generationService.generateQuestion(field);
        
        return {
          sessionId: session.id,
          text: questionText,
          isComplete: false,
        };
      }
    }

    // Step 2: Extraction (The Ear)
    // If we have a current field, extract data for it
    if (session.currentFieldId) {
      const targetField = this.blueprint.fields.find(
        (f) => f.id === session.currentFieldId,
      );
      
      if (targetField) {
        // Extract data from user's message
        const extractedData = await this.extractionService.extractData(
          [targetField],
          userText,
        );
        
        // Merge extracted data into session
        session.data = {
          ...session.data,
          ...extractedData,
        };
      }
    }

    // Step 3: Determine State (The Brain)
    const nextStep = this.orchestratorService.determineNextStep(
      this.blueprint,
      session.data,
    );
    
    // Update session with next field
    session.currentFieldId = nextStep.nextFieldId ?? undefined;
    
    // Update status if complete
    if (nextStep.isComplete) {
      session.status = 'COMPLETED';
    }
    
    // Save session to database
    await this.em.flush();

    // Step 4: Generation (The Mouth)
    let responseText: string;
    
    if (nextStep.isComplete) {
      // Generate completion message
      responseText = 'Thank you! I have collected all the necessary information. Your request has been completed.';
    } else if (nextStep.nextFieldId) {
      // Generate next question
      const nextField = this.blueprint.fields.find(
        (f) => f.id === nextStep.nextFieldId,
      );
      
      if (!nextField) {
        throw new Error('Field not found in blueprint');
      }
      
      responseText = await this.generationService.generateQuestion(nextField);
    } else {
      // Fallback (should not happen)
      responseText = 'I\'m not sure what to ask next.';
    }

    // Step 5: Return response
    return {
      sessionId: session.id,
      text: responseText,
      isComplete: nextStep.isComplete,
    };
  }
}
