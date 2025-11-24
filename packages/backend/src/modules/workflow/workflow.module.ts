import { Module } from '@nestjs/common';
import { WorkflowService } from './workflow.service';
import { ValidationModule } from '../../core/validation/validation.module';

/**
 * Workflow Module
 *
 * Provides the WorkflowService for managing conversational flow state.
 */
@Module({
  imports: [ValidationModule],
  providers: [WorkflowService],
  exports: [WorkflowService],
})
export class WorkflowModule {}
