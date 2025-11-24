import { Module } from '@nestjs/common';
import { WorkflowService } from './workflow.service';

/**
 * Workflow Module
 *
 * Provides the WorkflowService for managing conversational flow state.
 */
@Module({
  providers: [WorkflowService],
  exports: [WorkflowService],
})
export class WorkflowModule {}
