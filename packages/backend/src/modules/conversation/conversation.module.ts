import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { ConversationController } from './conversation.controller';
import { ConversationService } from './conversation.service';
import { ConversationFlowService } from './conversation.flow.service';
import { Conversation } from './conversation.entity';
import { WorkflowModule } from '../workflow/workflow.module';
import { IntelligenceModule } from '../intelligence/intelligence.module';
import { BlueprintModule } from '../blueprint/blueprint.module';
import { PluginModule } from '../../core/plugin/plugin.module';

@Module({
  imports: [
    MikroOrmModule.forFeature([Conversation]),
    WorkflowModule,
    IntelligenceModule,
    BlueprintModule,
    PluginModule,
  ],
  controllers: [ConversationController],
  providers: [ConversationService, ConversationFlowService],
  exports: [ConversationService, ConversationFlowService],
})
export class ConversationModule {}
