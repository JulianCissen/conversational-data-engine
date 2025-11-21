import { Module } from '@nestjs/common';
import { OrchestratorService } from './orchestrator.service';

/**
 * Orchestrator Module
 *
 * Provides the OrchestratorService for managing conversational flow state.
 */
@Module({
  providers: [OrchestratorService],
  exports: [OrchestratorService],
})
export class OrchestratorModule {}
